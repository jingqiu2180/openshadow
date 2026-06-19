// @ts-nocheck
/**
 * vector-store.ts — 基于 embedding 的向量记忆检索（remu 版）
 *
 * 用 MiniMax embedding API（OpenAI 兼容）把 fact 文本编码为 float 向量，
 * 存到 SQLite 的 `fact_embeddings` 表；检索时算余弦相似度。
 *
 * 设计要点：
 * - Lazy embedding：addFact / addMemory 时**不**同步生成 embedding，而是在
 *   第一次 searchByVector 时按需补齐（避免在不可用 embedding 时阻断写入）。
 * - 失败容错：embedding API 失败时抛错给调用方，调用方应 fallback 到 FTS5。
 * - 批处理：searchByVector 一次性 embed 多个候选 fact 的内容。
 */
import type { Database } from 'better-sqlite3'
import { getDb } from './store'
import { config } from '../config'
import { createClient, pickModel } from '../providers/index'
import { createModuleLogger } from '../debug-log'

const log = createModuleLogger('vector-store')

/** MiniMax embedding 模型名 */
const EMBEDDING_MODEL = 'embo-01'
/** 缓存到内存的 embedding 维度（首次 embed 后确定） */
let _dim: number | null = null

/**
 * Lazy create the fact_embeddings table. Idempotent.
 */
function ensureEmbeddingTable(): void {
  const db = getDb()
  db.exec(`
    CREATE TABLE IF NOT EXISTS fact_embeddings (
      fact_id    TEXT PRIMARY KEY,
      embedding  BLOB NOT NULL,
      model      TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (fact_id) REFERENCES facts(id) ON DELETE CASCADE
    )
  `)
}

/** 把 float 数组打包成 Buffer（little-endian float32） */
function packFloats(arr: number[]): Buffer {
  const buf = Buffer.alloc(arr.length * 4)
  for (let i = 0; i < arr.length; i++) {
    buf.writeFloatLE(arr[i], i * 4)
  }
  return buf
}

/** 把 Buffer 解回 float 数组 */
function unpackFloats(buf: Buffer): number[] {
  const arr: number[] = new Array(buf.length / 4)
  for (let i = 0; i < arr.length; i++) {
    arr[i] = buf.readFloatLE(i * 4)
  }
  return arr
}

/** 余弦相似度（已归一化的向量就是点积） */
function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / Math.sqrt(na * nb)
}

/**
 * Call the embedding API for one or more strings.
 * Returns a 2D array (one vector per input).
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const provider = config.getActiveProvider('small') ?? config.getActiveProvider('main')
  if (!provider) throw new Error('No active LLM provider for embeddings')
  const client = createClient(provider)
  const baseURL = (provider as any).baseUrl || (provider as any).baseURL
  // Use the OpenAI SDK directly to POST /v1/embeddings
  const response = await fetch(`${baseURL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      texts,
      model: EMBEDDING_MODEL,
      type: 'db',
    }),
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Embedding API ${response.status}: ${body.slice(0, 200)}`)
  }
  const data: any = await response.json()
  const vectors: number[][] | null = data?.vectors ?? null
  if (!vectors || vectors.length !== texts.length) {
    throw new Error(
      `Embedding API returned ${vectors?.length ?? 0} vectors for ${texts.length} inputs. ` +
      `Response: ${JSON.stringify(data).slice(0, 200)}`
    )
  }
  if (_dim === null) _dim = vectors[0].length
  return vectors
}

/**
 * Ensure `factId` has an embedding; create it lazily if missing.
 * Returns the embedding vector, or null if embedding failed.
 */
export async function ensureEmbedding(factId: string, content: string): Promise<number[] | null> {
  ensureEmbeddingTable()
  const db = getDb()
  const row = db
    .prepare('SELECT embedding FROM fact_embeddings WHERE fact_id = ?')
    .get(factId) as { embedding: Buffer } | undefined
  if (row) {
    return unpackFloats(row.embedding)
  }
  try {
    const [vec] = await embedTexts([content])
    db.prepare(
      'INSERT OR REPLACE INTO fact_embeddings (fact_id, embedding, model, created_at) VALUES (?, ?, ?, ?)'
    ).run(factId, packFloats(vec), EMBEDDING_MODEL, Date.now())
    return vec
  } catch (err) {
    log.warn(`ensureEmbedding failed for ${factId}: ${(err as Error).message}`)
    return null
  }
}

export interface VectorSearchHit {
  id: string
  content: string
  score: number
}

/**
 * Find the top-k facts most similar to `query` using cosine similarity.
 * Embeds the query once, then scores all facts in the `facts` table that
 * already have an embedding; lazily embeds facts that don't (up to
 * `embedBudget` per call to keep the request bounded).
 * Only searches facts belonging to `userId` (default 'default').
 */
export async function searchByVector(
  query: string,
  k: number = 5,
  userId: string = 'default',
  embedBudget: number = 32,
): Promise<VectorSearchHit[]> {
  ensureEmbeddingTable()
  const db = getDb()
  // 1. Embed the query
  let queryVec: number[]
  try {
    [queryVec] = await embedTexts([query])
  } catch (err) {
    log.warn(`Query embedding failed: ${(err as Error).message}`)
    return []
  }
  // 2. Load facts for this user (small dataset; FTS5/N is overkill here)
  const facts = db
    .prepare('SELECT id, content, importance FROM facts WHERE user_id = ? ORDER BY importance DESC LIMIT 500')
    .all(userId) as Array<{ id: string; content: string; importance: number }>
  // 3. Lazy-embed facts that don't have one yet (capped by embedBudget)
  let toEmbed = 0
  for (const f of facts) {
    const row = db
      .prepare('SELECT 1 FROM fact_embeddings WHERE fact_id = ?')
      .get(f.id)
    if (!row && toEmbed < embedBudget) {
      try {
        const [vec] = await embedTexts([f.content])
        db.prepare(
          'INSERT OR REPLACE INTO fact_embeddings (fact_id, embedding, model, created_at) VALUES (?, ?, ?, ?)'
        ).run(f.id, packFloats(vec), EMBEDDING_MODEL, Date.now())
        toEmbed++
      } catch {
        // Skip; this fact won't be scored.
      }
    }
  }
  // 4. Score
  const scored: VectorSearchHit[] = []
  for (const f of facts) {
    const row = db
      .prepare('SELECT embedding FROM fact_embeddings WHERE fact_id = ?')
      .get(f.id) as { embedding: Buffer } | undefined
    if (!row) continue
    const vec = unpackFloats(row.embedding)
    const score = cosineSimilarity(queryVec, vec)
    scored.push({ id: f.id, content: f.content, score })
  }
  // 5. Sort desc and take top-k
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, k)
}

/**
 * fact-store.ts — 深度记忆增强（参考 openhanako）
 * 
 * 新增功能：
 * - CJK 友好的搜索（bigram/trigram ngram）
 * - 增强的 FTS 查询构建
 * - 记忆编译（snapshot）支持
 */

import { getDb } from './store.js'
import type { Memory, Fact } from './store.js'
import { randomUUID } from 'crypto'

const CJK_RUN_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+/gu

function normalizeSearchText(text: string): string {
  return (text || '').normalize('NFKC').trim()
}

function cjkNgrams(text: string): string[] {
  const tokens: string[] = []
  CJK_RUN_RE.lastIndex = 0
  for (const match of normalizeSearchText(text).matchAll(CJK_RUN_RE)) {
    const chars = Array.from(match[0])
    for (const size of [2, 3]) {
      if (chars.length < size) continue
      for (let i = 0; i <= chars.length - size; i++) {
        tokens.push(chars.slice(i, i + size).join(''))
      }
    }
  }
  return tokens
}

function uniqueTokens(tokens: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const token of tokens) {
    const normalized = normalizeSearchText(token)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
  }
  return out
}

/**
 * 构建适合 FTS 搜索的文本（包含 CJK ngram）
 */
export function buildFactSearchText(fact: string, tags: string[] = []): string {
  const base = [fact, ...tags].map(normalizeSearchText).filter(Boolean).join(' ')
  const grams = cjkNgrams(base)
  return uniqueTokens([base, ...grams]).join(' ')
}

/**
 * 构建 FTS5 查询语句（支持 CJK ngram）
 */
function buildFtsQuery(query: string): string {
  const normalized = normalizeSearchText(query)
  if (!normalized) return ''
  
  const lexicalTokens = normalized.split(/\s+/)
  const grams = cjkNgrams(normalized)
  return uniqueTokens([...lexicalTokens, ...grams])
    .map(w => `"${w.replace(/"/g, '""')}"`)
    .join(' OR ')
}

/**
 * 增强的记忆搜索（使用 FTS5 + CJK ngram）
 */
export function searchMemoriesEnhanced(query: string, limit: number = 10, userId: string = 'default'): Memory[] {
  const db = getDb()
  const ftsQuery = buildFtsQuery(query)
  
  if (!ftsQuery) return []
  
  try {
    const stmt = db.prepare(`
      SELECT m.* FROM memories m
      JOIN memories_fts fts ON m.rowid = fts.rowid
      WHERE memories_fts MATCH ? AND m.user_id = ?
      ORDER BY rank
      LIMIT ?
    `)
    const rows = stmt.all(ftsQuery, userId, limit) as any[]
    return rows.map(row => ({
      id: row.id,
      content: row.content,
      importance: row.importance,
      created_at: row.created_at,
      last_accessed: row.last_accessed,
      access_count: row.access_count,
      memory_type: row.memory_type,
      tags: parseTagsFromRow(row.tags),
      session_id: row.session_id ?? '',
      user_id: row.user_id ?? userId,
    }))
  } catch {
    // FTS 不可用时降级到 LIKE
    const fallback = db.prepare(`SELECT * FROM memories WHERE user_id = ? AND content LIKE ? ORDER BY importance DESC LIMIT ?`)
    return (fallback.all(userId, `%${query}%`, limit) as any[]).map(row => ({
      id: row.id,
      content: row.content,
      importance: row.importance,
      created_at: row.created_at,
      last_accessed: row.last_accessed,
      access_count: row.access_count,
      memory_type: row.memory_type,
      tags: parseTagsFromRow(row.tags),
      session_id: row.session_id ?? '',
      user_id: row.user_id ?? userId,
    }))
  }
}

/**
 * 增强的事实搜索（使用 FTS5 + CJK ngram）
 */
export function searchFactsEnhanced(query: string, limit: number = 10, userId: string = 'default'): Fact[] {
  const db = getDb()
  const ftsQuery = buildFtsQuery(query)
  
  if (!ftsQuery) return []
  
  try {
    const stmt = db.prepare(`
      SELECT f.* FROM facts f
      JOIN facts_fts fts ON f.rowid = fts.rowid
      WHERE facts_fts MATCH ? AND f.user_id = ?
      ORDER BY rank
      LIMIT ?
    `)
    const rows = stmt.all(ftsQuery, userId, limit) as any[]
    return rows.map(row => ({
      id: row.id,
      content: row.content,
      tags: parseTagsFromRow(row.tags),
      session_id: row.session_id ?? '',
      created_at: row.created_at,
      source_type: row.source_type,
      importance: row.importance,
      user_id: row.user_id ?? userId,
    }))
  } catch {
    const fallback = db.prepare(`SELECT * FROM facts WHERE user_id = ? AND content LIKE ? ORDER BY importance DESC LIMIT ?`)
    return (fallback.all(userId, `%${query}%`, limit) as any[]).map(row => ({
      id: row.id,
      content: row.content,
      tags: parseTagsFromRow(row.tags),
      session_id: row.session_id ?? '',
      created_at: row.created_at,
      source_type: row.source_type,
      importance: row.importance,
      user_id: row.user_id ?? userId,
    }))
  }
}

function parseTagsFromRow(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((t: unknown) => typeof t === 'string')
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return [] }
  }
  return []
}

/**
 * 将多条记忆编译成一个"快照"事实
 * 减少上下文占用，提高检索效率
 */
export function compileMemoriesToSnapshot(
  memoryIds: string[],
  compiledContent: string,
  importance: number = 4,
): Memory {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()
  
  const stmt = db.prepare(`
    INSERT INTO memories (id, content, importance, created_at, last_accessed, access_count, memory_type, tags, session_id)
    VALUES (?, ?, ?, ?, ?, 0, 'fact', '["compiled"]', '')
  `)
  stmt.run(id, compiledContent, importance, now, now)
  
  // 标记源记忆为已编译
  const updateStmt = db.prepare(`UPDATE memories SET tags = json_set(tags, '$[#]', 'compiled') WHERE id = ?`)
  for (const mid of memoryIds) {
    try { updateStmt.run(mid) } catch { /* ignore */ }
  }
  
  return {
    id,
    content: compiledContent,
    importance,
    created_at: now,
    last_accessed: now,
    access_count: 0,
    memory_type: 'fact',
    tags: ['compiled'],
    session_id: '',
  }
}

/**
 * 自动编译：将旧的 conversation 记忆编译成 fact
 * 定期调用（如每天一次）
 */
export function autoCompileOldMemories(
  daysThreshold: number = 7,
  minCount: number = 5,
): number {
  const db = getDb()
  const cutoff = Date.now() - daysThreshold * 24 * 60 * 60 * 1000
  
  // 查找同一 session 的旧记忆
  const oldMemories = db.prepare(`
    SELECT * FROM memories 
    WHERE memory_type = 'conversation' 
      AND created_at < ?
      AND tags NOT LIKE '%compiled%'
    ORDER BY session_id, created_at
  `).all(cutoff) as any[]
  
  if (oldMemories.length < minCount) return 0
  
  // 按 session 分组
  const bySession: Record<string, any[]> = {}
  for (const mem of oldMemories) {
    const sid = mem.session_id || 'default'
    if (!bySession[sid]) bySession[sid] = []
    bySession[sid].push(mem)
  }
  
  let compiledCount = 0
  for (const [sessionId, mems] of Object.entries(bySession)) {
    if (mems.length < minCount) continue
    
    const compiledContent = `[编译快照] Session ${sessionId}: ${mems.length} 条对话记忆，时间范围：${new Date(mems[0].created_at).toISOString()} - ${new Date(mems[mems.length - 1].created_at).toISOString()}`
    
    compileMemoriesToSnapshot(
      mems.map(m => m.id),
      compiledContent,
      4, // 高重要性
    )
    compiledCount++
  }
  
  return compiledCount
}

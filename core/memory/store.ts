import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import { readFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.REMO_DATA_DIR ?? join(__dirname, '../../data')
const DB_PATH = join(DATA_DIR, 'agent.db')

export interface Memory {
  id: string
  content: string
  importance: number
  created_at: number
  last_accessed: number
  access_count: number
  memory_type: 'conversation' | 'fact' | 'preference' | 'system'
  tags: string[]
  session_id: string
}

export interface Fact {
  id: string
  content: string
  tags: string[]
  session_id: string
  created_at: number
  source_type: 'extraction' | 'user_input' | 'system'
  importance: number
}

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true })
    }
    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    initSchema(_db)
  }
  return _db
}

function initSchema(db: Database.Database): void {
  const schema = readFileSync(join(__dirname, '../../db/schema.sql'), 'utf-8')
  db.exec(schema)
}

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((t: unknown) => typeof t === 'string')
  if (typeof raw === 'string') {
    try { return JSON.parse(raw).filter((t: unknown) => typeof t === 'string') } catch { return [] }
  }
  return []
}

function rowToMemory(row: any): Memory {
  return {
    id: row.id,
    content: row.content,
    importance: row.importance,
    created_at: row.created_at,
    last_accessed: row.last_accessed,
    access_count: row.access_count,
    memory_type: row.memory_type,
    tags: parseTags(row.tags),
    session_id: row.session_id ?? '',
  }
}

function rowToFact(row: any): Fact {
  return {
    id: row.id,
    content: row.content,
    tags: parseTags(row.tags),
    session_id: row.session_id ?? '',
    created_at: row.created_at,
    source_type: row.source_type,
    importance: row.importance,
  }
}

// ─── Memory Operations ────────────────────────────────────────────────────────

export function addMemory(
  content: string,
  importance: number = 1,
  memoryType: Memory['memory_type'] = 'conversation',
  tags: string[] = [],
  sessionId: string = '',
): Memory {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()

  const stmt = db.prepare(`
    INSERT INTO memories (id, content, importance, created_at, last_accessed, access_count, memory_type, tags, session_id)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
  `)
  stmt.run(id, content, importance, now, now, memoryType, JSON.stringify(tags), sessionId)

  return { id, content, importance, created_at: now, last_accessed: now, access_count: 0, memory_type: memoryType, tags, session_id }
}

export function getRecentMemories(limit: number = 50): Memory[] {
  const db = getDb()
  const stmt = db.prepare(`SELECT * FROM memories ORDER BY created_at DESC LIMIT ?`)
  return (stmt.all(limit) as any[]).map(rowToMemory)
}

export function getMemoriesByType(type: Memory['memory_type'], limit: number = 20): Memory[] {
  const db = getDb()
  const stmt = db.prepare(`SELECT * FROM memories WHERE memory_type = ? ORDER BY importance DESC, created_at DESC LIMIT ?`)
  return (stmt.all(type, limit) as any[]).map(rowToMemory)
}

export function accessMemory(id: string): void {
  const db = getDb()
  const stmt = db.prepare(`UPDATE memories SET last_accessed = ?, access_count = access_count + 1 WHERE id = ?`)
  stmt.run(Date.now(), id)
}

export function getMemoryById(id: string): Memory | null {
  const db = getDb()
  const stmt = db.prepare('SELECT * FROM memories WHERE id = ?')
  const row = stmt.get(id) as any
  return row ? rowToMemory(row) : null
}

export function cleanupOldMemories(maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): number {
  const db = getDb()
  const cutoff = Date.now() - maxAgeMs
  const stmt = db.prepare(`
    DELETE FROM memories
    WHERE last_accessed < ?
      AND access_count < 3
      AND importance < 4
      AND memory_type != 'fact'
  `)
  const result = stmt.run(cutoff)
  return result.changes
}

export function updateMemoryImportance(id: string, importance: number): void {
  const db = getDb()
  const stmt = db.prepare('UPDATE memories SET importance = ? WHERE id = ?')
  stmt.run(importance, id)
}

export function getContextMemories(limit: number = 20): Memory[] {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT * FROM (
      SELECT *, 1 as priority FROM memories WHERE memory_type = 'fact' AND importance >= 3
      UNION ALL
      SELECT *, 2 as priority FROM memories WHERE memory_type = 'preference' AND importance >= 3
      UNION ALL
      SELECT *, 3 as priority FROM memories ORDER BY created_at DESC LIMIT 30
    ) combined
    ORDER BY priority, last_accessed DESC
    LIMIT ?
  `)
  return (stmt.all(limit) as any[]).map(rowToMemory)
}

export function searchMemories(query: string, limit: number = 10): Memory[] {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT m.* FROM memories m
    JOIN memories_fts fts ON m.rowid = fts.rowid
    WHERE memories_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `)
  try {
    return (stmt.all(query, limit) as any[]).map(rowToMemory)
  } catch {
    const fallback = db.prepare(`SELECT * FROM memories WHERE content LIKE ? ORDER BY importance DESC LIMIT ?`)
    return (fallback.all(`%${query}%`, limit) as any[]).map(rowToMemory)
  }
}

export function findMemoriesByTag(tag: string, limit: number = 20): Memory[] {
  const db = getDb()
  const stmt = db.prepare(`SELECT * FROM memories WHERE tags LIKE ? ORDER BY importance DESC, created_at DESC LIMIT ?`)
  return (stmt.all(`%"${tag}"%`, limit) as any[]).map(rowToMemory)
}

// ─── Fact Operations ─────────────────────────────────────────────────────────

export function addFact(
  content: string,
  tags: string[] = [],
  sessionId: string = '',
  sourceType: Fact['source_type'] = 'extraction',
  importance: number = 3,
): Fact {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()

  const stmt = db.prepare(`
    INSERT INTO facts (id, content, tags, session_id, created_at, source_type, importance)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(id, content, JSON.stringify(tags), sessionId, now, sourceType, importance)

  return { id, content, tags, session_id: sessionId, created_at: now, source_type: sourceType, importance }
}

export function getFacts(limit: number = 50): Fact[] {
  const db = getDb()
  const stmt = db.prepare(`SELECT * FROM facts ORDER BY importance DESC, created_at DESC LIMIT ?`)
  return (stmt.all(limit) as any[]).map(rowToFact)
}

export function searchFacts(query: string, limit: number = 10): Fact[] {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT f.* FROM facts f
    JOIN facts_fts fts ON f.rowid = fts.rowid
    WHERE facts_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `)
  try {
    return (stmt.all(query, limit) as any[]).map(rowToFact)
  } catch {
    const fallback = db.prepare(`SELECT * FROM facts WHERE content LIKE ? ORDER BY importance DESC LIMIT ?`)
    return (fallback.all(`%${query}%`, limit) as any[]).map(rowToFact)
  }
}

export function findFactsByTag(tag: string, limit: number = 20): Fact[] {
  const db = getDb()
  const stmt = db.prepare(`SELECT * FROM facts WHERE tags LIKE ? ORDER BY importance DESC, created_at DESC LIMIT ?`)
  return (stmt.all(`%"${tag}"%`, limit) as any[]).map(rowToFact)
}

// ─── Agent Operations ─────────────────────────────────────────────────────────

export interface AgentConfig {
  id: string
  name: string
  personality: string
  model: string
  apiKey: string
  baseUrl: string
  allowedPaths: string[]
  createdAt: number
  updatedAt: number
}

export function saveAgentConfig(config: Omit<AgentConfig, 'createdAt' | 'updatedAt'>): void {
  const db = getDb()
  const now = Date.now()
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO agents (id, name, personality, model, api_key, base_url, allowed_paths, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM agents WHERE id = ?), ?), ?)
  `)
  stmt.run(config.id, config.name, config.personality, config.model, config.apiKey, config.baseUrl, JSON.stringify(config.allowedPaths), config.id, now, now)
}

export function getAgentConfig(id: string): (Omit<AgentConfig, 'allowedPaths'> & { allowedPaths: string[] }) | null {
  const db = getDb()
  const stmt = db.prepare('SELECT * FROM agents WHERE id = ?')
  const row = stmt.get(id) as any
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    personality: row.personality,
    model: row.model,
    apiKey: row.api_key,
    baseUrl: row.base_url,
    allowedPaths: JSON.parse(row.allowed_paths),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ─── Cron Job Operations ───────────────────────────────────────────────────────

export interface CronJob {
  id: string
  agentId: string
  schedule: string
  task: string
  lastRun: number | null
  enabled: boolean
}

export function addCronJob(agentId: string, schedule: string, task: string): CronJob {
  const db = getDb()
  const id = randomUUID()
  const stmt = db.prepare(`
    INSERT INTO cron_jobs (id, agent_id, schedule, task, last_run, enabled)
    VALUES (?, ?, ?, ?, NULL, 1)
  `)
  stmt.run(id, agentId, schedule, task)
  return { id, agentId, schedule, task, lastRun: null, enabled: true }
}

export function getCronJobs(agentId: string): CronJob[] {
  const db = getDb()
  const stmt = db.prepare('SELECT * FROM cron_jobs WHERE agent_id = ? AND enabled = 1')
  return (stmt.all(agentId) as any[]).map(row => ({
    id: row.id,
    agentId: row.agent_id,
    schedule: row.schedule,
    task: row.task,
    lastRun: row.last_run,
    enabled: Boolean(row.enabled),
  }))
}

export function updateCronJobLastRun(id: string): void {
  const db = getDb()
  const stmt = db.prepare('UPDATE cron_jobs SET last_run = ? WHERE id = ?')
  stmt.run(Date.now(), id)
}

export function deleteCronJob(id: string): void {
  const db = getDb()
  const stmt = db.prepare('DELETE FROM cron_jobs WHERE id = ?')
  stmt.run(id)
}

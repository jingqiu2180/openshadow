/**
 * Pinned Memory Store（对齐 openhanako）
 * 管理固定记忆，支持重要性评分、自动清理、搜索
 */

import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const DB_PATH = path.join(ROOT, 'data', 'pinned-memories.db')

interface PinnedMemory {
  id: string
  content: string
  keywords: string // JSON array
  importance: number // 0-1
  createdAt: string
  lastAccessedAt: string
  accessCount: number
}

export class PinnedMemoryStore {
  private db: Database.Database

  constructor() {
    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    this.db = new Database(DB_PATH)
    this.initSchema()
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pinned_memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        keywords TEXT NOT NULL DEFAULT '[]',
        importance REAL NOT NULL DEFAULT 0.5,
        created_at TEXT NOT NULL,
        last_accessed_at TEXT NOT NULL,
        access_count INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_pinned_importance ON pinned_memories(importance DESC);
      CREATE INDEX IF NOT EXISTS idx_pinned_last_accessed ON pinned_memories(last_accessed_at DESC);
    `)
  }

  /** 添加或更新固定记忆 */
  upsert(memory: Omit<PinnedMemory, 'createdAt' | 'lastAccessedAt' | 'accessCount'> & { importance?: number }): void {
    const now = new Date().toISOString()
    const id = memory.id || this.generateId()
    const stmt = this.db.prepare(`
      INSERT INTO pinned_memories (id, content, keywords, importance, created_at, last_accessed_at, access_count)
      VALUES (?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(id) DO UPDATE SET
        content = excluded.content,
        keywords = excluded.keywords,
        importance = excluded.importance,
        last_accessed_at = ?
    `)
    stmt.run(
      id,
      memory.content,
      memory.keywords,
      memory.importance ?? 0.5,
      now,
      now,
      now // ON CONFLICT 的 last_accessed_at
    )
  }

  /** 生成唯一 ID */
  private generateId(): string {
    const crypto = require('crypto')
    return `pin_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`
  }

  /** 获取单条记忆 */
  get(id: string): PinnedMemory | null {
    const row = this.db.prepare('SELECT * FROM pinned_memories WHERE id = ?').get(id) as any
    if (!row) return null
    return this.rowToMemory(row)
  }

  /** 根据关键词搜索 */
  search(keyword: string, limit: number = 5): PinnedMemory[] {
    const rows = this.db.prepare(`
      SELECT * FROM pinned_memories
      WHERE content LIKE ? OR keywords LIKE ?
      ORDER BY importance DESC, access_count DESC
      LIMIT ?
    `).all(`%${keyword}%`, `%${keyword}%`, limit) as any[]
    return rows.map(r => this.rowToMemory(r))
  }

  /** 列出所有记忆（按重要性排序） */
  listAll(limit: number = 50): PinnedMemory[] {
    const rows = this.db.prepare(`
      SELECT * FROM pinned_memories
      ORDER BY importance DESC, last_accessed_at DESC
      LIMIT ?
    `).all(limit) as any[]
    return rows.map(r => this.rowToMemory(r))
  }

  /** 访问计数 +1，更新 lastAccessedAt */
  touch(id: string): void {
    this.db.prepare(`
      UPDATE pinned_memories
      SET access_count = access_count + 1, last_accessed_at = ?
      WHERE id = ?
    `).run(new Date().toISOString(), id)
  }

  /** 删除单条 */
  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM pinned_memories WHERE id = ?').run(id)
    return result.changes > 0
  }

  /** 清理低重要性 + 久未访问的记忆 */
  cleanup(retainCount: number = 20): number {
    // 保留最重要的 retainCount 条，删除其余
    const toDelete = this.db.prepare(`
      SELECT id FROM pinned_memories
      ORDER BY importance DESC, last_accessed_at DESC
      LIMIT -1 OFFSET ?
    `).all(retainCount) as any[]
    const ids = toDelete.map(r => r.id)
    if (ids.length === 0) return 0
    const placeholders = ids.map(() => '?').join(',')
    const result = this.db.prepare(`DELETE FROM pinned_memories WHERE id IN (${placeholders})`).run(...ids)
    return result.changes
  }

  /** 清空所有 */
  clear(): number {
    const result = this.db.prepare('DELETE FROM pinned_memories').run()
    return result.changes
  }

  private rowToMemory(row: any): PinnedMemory {
    return {
      id: row.id,
      content: row.content,
      keywords: row.keywords,
      importance: row.importance,
      createdAt: row.created_at,
      lastAccessedAt: row.last_accessed_at,
      accessCount: row.access_count,
    }
  }

  close(): void {
    this.db.close()
  }
}

// 单例
let _instance: PinnedMemoryStore | null = null
export function getPinnedMemoryStore(): PinnedMemoryStore {
  if (!_instance) _instance = new PinnedMemoryStore()
  return _instance
}

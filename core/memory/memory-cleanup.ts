// @ts-nocheck
/**
 * memory-cleanup.ts — 自动清理过期记忆
 *
 * 按 created_at 字段删除 N 天前的 fact / memory 记录，连带清理对应的
 * fact_embeddings 行。默认 30 天（环境 MEMORY_RETENTION_DAYS 可调）。
 *
 * 设计要点：
 * - 不会物理删文件（facts 是 SQLite 表里，删除 = 物理删 row）。
 * - 分批删除（默认 100/批），避免长事务。
 * - 永远保留 importance >= 4 的高价值 fact（业务关键信息不能误删）。
 */
import { getDb } from './store'
import { createModuleLogger } from '../debug-log'

const log = createModuleLogger('memory-cleanup')

const DEFAULT_RETENTION_DAYS = 30
const DEFAULT_BATCH_SIZE = 100
/** importance >= 这个值永远不被清理 */
const PROTECTED_IMPORTANCE = 4

export interface CleanupResult {
  scanned: number
  deleted: number
  skippedProtected: number
  cutoffIso: string
  dryRun: boolean
}

export interface CleanupOptions {
  /** 保留多少天 (默认 30) */
  retentionDays?: number
  /** 每批删除行数 (默认 100) */
  batchSize?: number
  /** 试运行：只统计不真删 */
  dryRun?: boolean
  /** 多用户隔离：只清理指定 userId 的记忆（不传则清所有用户） */
  userId?: string
}

/**
 * 清理 N 天前的 fact 记录及对应 embedding。
 * Returns a structured result so callers (CLI / Ticker) can log it.
 */
export function cleanupOldFacts(opts: CleanupOptions = {}): CleanupResult {
  const retentionDays = opts.retentionDays
    ?? Number(process.env.MEMORY_RETENTION_DAYS ?? DEFAULT_RETENTION_DAYS)
  const batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE
  const dryRun = opts.dryRun ?? false
  const userId = opts.userId
  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  const cutoffIso = new Date(cutoffMs).toISOString()
  const db = getDb()

  const userFilter = userId ? 'AND user_id = ?' : ''
  const userParams: any[] = userId ? [userId] : []

  // 1. Count how many we'd touch
  const countRow = db
    .prepare(
      `SELECT COUNT(*) AS n FROM facts
       WHERE created_at < ? AND importance < ? ${userFilter}`
    )
    .get(cutoffMs, PROTECTED_IMPORTANCE, ...userParams) as { n: number }
  const protectedRow = db
    .prepare(
      `SELECT COUNT(*) AS n FROM facts
       WHERE created_at < ? AND importance >= ? ${userFilter}`
    )
    .get(cutoffMs, PROTECTED_IMPORTANCE, ...userParams) as { n: number }

  if (dryRun) {
    return {
      scanned: countRow.n + protectedRow.n,
      deleted: 0,
      skippedProtected: protectedRow.n,
      cutoffIso,
      dryRun: true,
    }
  }

  // 2. Delete in batches
  let deleted = 0
  while (true) {
    const ids = db
      .prepare(
        `SELECT id FROM facts
         WHERE created_at < ? AND importance < ? ${userFilter}
         LIMIT ?`
      )
      .all(cutoffMs, PROTECTED_IMPORTANCE, ...userParams, batchSize) as Array<{ id: string }>
    if (ids.length === 0) break
    for (const { id } of ids) {
      const result = db.prepare('DELETE FROM facts WHERE id = ?').run(id)
      deleted += result.changes
    }
    if (ids.length < batchSize) break
  }

  // 3. Also cleanup orphaned embeddings
  const orphanResult = db
    .prepare(
      `DELETE FROM fact_embeddings
       WHERE fact_id NOT IN (SELECT id FROM facts)`
    )
    .run()

  log.info(
    `Cleanup done: deleted ${deleted} facts, removed ${orphanResult.changes} orphaned embeddings, ` +
    `skipped ${protectedRow.n} protected (importance >= ${PROTECTED_IMPORTANCE}), ` +
    `cutoff=${cutoffIso}, retentionDays=${retentionDays}` +
    (userId ? `, userId=${userId}` : '')
  )

  return {
    scanned: countRow.n + protectedRow.n,
    deleted,
    skippedProtected: protectedRow.n,
    cutoffIso,
    dryRun: false,
  }
}

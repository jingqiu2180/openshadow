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
import { getDb } from './store.js'
import { createModuleLogger } from '../debug-log.js'

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
  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  const cutoffIso = new Date(cutoffMs).toISOString()
  const db = getDb()

  // 1. Count how many we'd touch
  const countRow = db
    .prepare(
      `SELECT COUNT(*) AS n FROM facts
       WHERE created_at < ? AND importance < ?`
    )
    .get(cutoffMs, PROTECTED_IMPORTANCE) as { n: number }
  const protectedRow = db
    .prepare(
      `SELECT COUNT(*) AS n FROM facts
       WHERE created_at < ? AND importance >= ?`
    )
    .get(cutoffMs, PROTECTED_IMPORTANCE) as { n: number }

  if (dryRun) {
    return {
      scanned: countRow.n + protectedRow.n,
      deleted: 0,
      skippedProtected: protectedRow.n,
      cutoffIso,
      dryRun: true,
    }
  }

  // 2. Delete in batches (the fact_embeddings FK is ON DELETE CASCADE so
  //    they go away with the fact row).
  let deleted = 0
  while (true) {
    const ids = db
      .prepare(
        `SELECT id FROM facts
         WHERE created_at < ? AND importance < ?
         LIMIT ?`
      )
      .all(cutoffMs, PROTECTED_IMPORTANCE, batchSize) as Array<{ id: string }>
    if (ids.length === 0) break
    const idList = ids.map(r => `'${r.id}'`).join(',')
    const result = db.exec(`DELETE FROM facts WHERE id IN (${idList})`)
    // better-sqlite3 returns { changes } per exec; sum them.
    const changes = (result as any).changes ?? ids.length
    deleted += changes
    if (ids.length < batchSize) break
  }

  // 3. Also clean up orphaned embeddings (in case FK CASCADE was ever
  //    bypassed by a manual import).
  const orphanResult = db
    .prepare(
      `DELETE FROM fact_embeddings
       WHERE fact_id NOT IN (SELECT id FROM facts)`
    )
    .run()

  log.info(
    `Cleanup done: deleted ${deleted} facts, removed ${orphanResult.changes} orphaned embeddings, ` +
    `skipped ${protectedRow.n} protected (importance >= ${PROTECTED_IMPORTANCE}), ` +
    `cutoff=${cutoffIso}, retentionDays=${retentionDays}`
  )

  return {
    scanned: countRow.n + protectedRow.n,
    deleted,
    skippedProtected: protectedRow.n,
    cutoffIso,
    dryRun: false,
  }
}

// @ts-nocheck
import { getDb } from '../memory/store'

export interface UsageRecord {
  id: string
  providerId: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  latencyMs: number
  timestamp: number
  sessionId: string
}

export interface UsageSummary {
  providerId: string
  model: string
  totalRequests: number
  totalPromptTokens: number
  totalCompletionTokens: number
  totalTokens: number
  avgLatencyMs: number
  period: 'hour' | 'day' | 'week' | 'month'
}

export class UsageTracker {
  record(usage: Omit<UsageRecord, 'id' | 'timestamp'>): void {
    const db = getDb()
    db.exec(`
      CREATE TABLE IF NOT EXISTS usage_logs (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        model TEXT NOT NULL,
        prompt_tokens INTEGER DEFAULT 0,
        completion_tokens INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        latency_ms INTEGER DEFAULT 0,
        timestamp INTEGER NOT NULL,
        session_id TEXT DEFAULT ''
      )
    `)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage_logs(timestamp DESC)`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_usage_provider ON usage_logs(provider_id, model)`)

    const id = `usage_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const now = Date.now()

    const stmt = db.prepare(`
      INSERT INTO usage_logs (id, provider_id, model, prompt_tokens, completion_tokens, total_tokens, latency_ms, timestamp, session_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(id, usage.providerId, usage.model, usage.promptTokens, usage.completionTokens, usage.totalTokens, usage.latencyMs, now, usage.sessionId)
  }

  getSummary(period: 'hour' | 'day' | 'week' | 'month' = 'day', providerId?: string): UsageSummary[] {
    const db = getDb()
    const periodMs: Record<string, number> = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
    }
    const cutoff = Date.now() - periodMs[period]

    let query = `
      SELECT provider_id, model,
             COUNT(*) as total_requests,
             SUM(prompt_tokens) as total_prompt_tokens,
             SUM(completion_tokens) as total_completion_tokens,
             SUM(total_tokens) as total_tokens,
             AVG(latency_ms) as avg_latency_ms
      FROM usage_logs
      WHERE timestamp >= ?
    `
    const params: any[] = [cutoff]

    if (providerId) {
      query += ` AND provider_id = ?`
      params.push(providerId)
    }

    query += ` GROUP BY provider_id, model ORDER BY total_tokens DESC`

    try {
      const stmt = db.prepare(query)
      return (stmt.all(...params) as any[]).map(row => ({
        providerId: row.provider_id,
        model: row.model,
        totalRequests: row.total_requests,
        totalPromptTokens: row.total_prompt_tokens ?? 0,
        totalCompletionTokens: row.total_completion_tokens ?? 0,
        totalTokens: row.total_tokens ?? 0,
        avgLatencyMs: Math.round(row.avg_latency_ms ?? 0),
        period,
      }))
    } catch {
      return []
    }
  }

  getTotalUsage(providerId?: string): { totalTokens: number; totalRequests: number } {
    const db = getDb()
    try {
      let query = 'SELECT SUM(total_tokens) as total, COUNT(*) as count FROM usage_logs'
      const params: any[] = []
      if (providerId) {
        query += ' WHERE provider_id = ?'
        params.push(providerId)
      }
      const row = db.prepare(query).get(...params) as any
      return { totalTokens: row?.total ?? 0, totalRequests: row?.count ?? 0 }
    } catch {
      return { totalTokens: 0, totalRequests: 0 }
    }
  }

  cleanupOldLogs(maxAgeMs: number = 90 * 24 * 60 * 60 * 1000): number {
    const db = getDb()
    try {
      const cutoff = Date.now() - maxAgeMs
      const result = db.prepare('DELETE FROM usage_logs WHERE timestamp < ?').run(cutoff)
      return result.changes
    } catch {
      return 0
    }
  }
}

export const usageTracker = new UsageTracker()

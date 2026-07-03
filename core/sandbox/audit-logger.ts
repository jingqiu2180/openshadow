/**
 * AuditLogger: records all sandbox operations for security review.
 */

export type OperationType = 'bash' | 'file_read' | 'file_write' | 'file_delete' | 'network' | 'tool_use'

export type OperationResult = 'success' | 'failure' | 'blocked' | 'timeout'

export interface AuditEntry {
  id: string
  timestamp: string       // ISO 8601
  sessionId: string
  operation: OperationType
  command?: string
  target?: string
  result: OperationResult
  reason?: string         // why blocked/timeout
  durationMs: number
  risk: 'low' | 'medium' | 'high' | 'critical'
  metadata?: Record<string, unknown>
}

export interface AuditLog {
  entries: AuditEntry[]
  sessionId: string
  startedAt: string
  lastUpdated: string
}

export class AuditLogger {
  private log: AuditLog
  private entryCounter = 0

  constructor(sessionId: string) {
    this.log = {
      entries: [],
      sessionId,
      startedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    }
  }

  /**
   * Record an operation.
   */
  logOperation(
    operation: OperationType,
    result: OperationResult,
    opts: {
      command?: string
      target?: string
      reason?: string
      durationMs: number
      risk?: 'low' | 'medium' | 'high' | 'critical'
      metadata?: Record<string, unknown>
    }
  ): void {
    const entry: AuditEntry = {
      id: `${this.log.sessionId}-${++this.entryCounter}`.padStart(8, '0'),
      timestamp: new Date().toISOString(),
      sessionId: this.log.sessionId,
      operation,
      command: opts.command,
      target: opts.target,
      result,
      reason: opts.reason,
      durationMs: opts.durationMs,
      risk: opts.risk ?? 'low',
      metadata: opts.metadata,
    }
    this.log.entries.push(entry)
    this.log.lastUpdated = entry.timestamp
  }

  /**
   * Get entries filtered by risk level.
   */
  getHighRiskEntries(): AuditEntry[] {
    return this.log.entries.filter(e => e.risk === 'high' || e.risk === 'critical')
  }

  /**
   * Get entries filtered by operation type.
   */
  getByOperation(operation: OperationType): AuditEntry[] {
    return this.log.entries.filter(e => e.operation === operation)
  }

  /**
   * Get all entries.
   */
  getEntries(): AuditEntry[] {
    return [...this.log.entries]
  }

  /**
   * Export full audit log.
   */
  export(): AuditLog {
    return structuredClone(this.log)
  }

  /**
   * Get summary statistics.
   */
  getSummary(): {
    total: number
    success: number
    failure: number
    blocked: number
    timeout: number
    byRisk: Record<string, number>
    byOperation: Record<string, number>
  } {
    const summary = {
      total: this.log.entries.length,
      success: 0,
      failure: 0,
      blocked: 0,
      timeout: 0,
      byRisk: {} as Record<string, number>,
      byOperation: {} as Record<string, number>,
    }

    for (const entry of this.log.entries) {
      summary[entry.result]++
      summary.byRisk[entry.risk] = (summary.byRisk[entry.risk] ?? 0) + 1
      summary.byOperation[entry.operation] = (summary.byOperation[entry.operation] ?? 0) + 1
    }

    return summary
  }

  getSessionId(): string {
    return this.log.sessionId
  }
}
// @ts-nocheck
/**
 * Sandbox Manager: manages multiple sandboxed environments per session.
 *
 * Provides factory + lifecycle management for Sandbox instances.
 */

import { Sandbox, SandboxConfig } from './sandbox.js'
import { AuditLogger } from './audit-logger.js'

export interface SandboxManagerConfig {
  /** Root directory for all sandboxed workspaces */
  workspaceRoot: string
  /** Default timeout per command (ms) */
  defaultTimeoutMs?: number
  /** Max concurrent sandboxes */
  maxSandboxes?: number
}

export class SandboxManager {
  private readonly config: Required<SandboxManagerConfig>
  private readonly sandboxes = new Map<string, Sandbox>()
  private readonly globalAudit = new AuditLogger('global')

  constructor(config: SandboxManagerConfig) {
    this.config = {
      workspaceRoot: config.workspaceRoot,
      defaultTimeoutMs: config.defaultTimeoutMs ?? 30_000,
      maxSandboxes: config.maxSandboxes ?? 10,
    }
  }

  /**
   * Create or get a sandbox for a session.
   */
  getSandbox(sessionId: string, extraConfig?: Partial<SandboxConfig>): Sandbox {
    if (this.sandboxes.has(sessionId)) {
      return this.sandboxes.get(sessionId)!
    }

    if (this.sandboxes.size >= this.config.maxSandboxes) {
      // Evict the oldest sandbox
      const oldest = this.sandboxes.keys().next().value
      if (oldest) {
        this.sandboxes.get(oldest)!.cleanup()
        this.sandboxes.delete(oldest)
      }
    }

    const sessionDir = `${this.config.workspaceRoot}/${sessionId}`

    const sandbox = new Sandbox({
      sessionId,
      allowedDir: sessionDir,
      timeoutMs: this.config.defaultTimeoutMs,
      ...extraConfig,
    })

    this.sandboxes.set(sessionId, sandbox)
    return sandbox
  }

  /**
   * Destroy a sandbox session.
   */
  destroySandbox(sessionId: string): void {
    const sandbox = this.sandboxes.get(sessionId)
    if (sandbox) {
      sandbox.cleanup()
      this.sandboxes.delete(sessionId)
    }
  }

  /**
   * Get count of active sandboxes.
   */
  getActiveCount(): number {
    return this.sandboxes.size
  }

  /**
   * List all active session IDs.
   */
  getActiveSessions(): string[] {
    return [...this.sandboxes.keys()]
  }

  /**
   * Get global audit log across all sandboxes.
   */
  getGlobalAuditSummary() {
    return this.globalAudit.getSummary()
  }
}

export { Sandbox } from './sandbox.js'
export { AuditLogger } from './audit-logger.js'
export { CircuitBreaker } from './circuit-breaker.js'
export { NetworkFilter } from './network-filter.js'
export type { SandboxConfig } from './sandbox.js'
export type { AuditEntry, OperationType, OperationResult } from './audit-logger.js'
export type { CircuitState, CircuitBreakerConfig } from './circuit-breaker.js'
export type { NetworkFilterConfig } from './network-filter.js'
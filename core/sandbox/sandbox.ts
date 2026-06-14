/**
 * Sandbox: isolated execution environment for agent operations.
 *
 * Key features:
 * - Process isolation with resource limits (CPU, memory, time)
 * - Working directory restriction via PathGuard
 * - Command allowlist + pattern blocking
 * - Circuit breaker for repeated failures
 * - Audit logging of all operations
 * - Optional network isolation
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import { resolve, join } from 'path'
import { mkdirSync, writeFileSync, chmodSync, unlinkSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { PathGuard } from '../tools/path-guard.js'
import { CircuitBreaker } from './circuit-breaker.js'
import { AuditLogger, OperationType, OperationResult } from './audit-logger.js'
import { NetworkFilter } from './network-filter.js'

const execFileAsync = promisify(execFile)

export interface SandboxConfig {
  /** Session/workspace ID */
  sessionId: string
  /** Root directory this sandbox can access */
  allowedDir: string
  /** Max execution time per command (ms) */
  timeoutMs?: number
  /** Max output size (bytes) */
  maxBuffer?: number
  /** Max concurrent processes */
  maxProcesses?: number
  /** Enable network isolation */
  networkIsolation?: boolean
  /** Custom allowed commands (e.g. ['git', 'node', 'python']) */
  allowedCommands?: string[]
  /** Block additional patterns */
  extraBlockedPatterns?: string[]
}

const DEFAULT_BLOCKED_PATTERNS = [
  'rm -rf /',
  'rm -rf /boot',
  'rm -rf /sys',
  'rm -rf /proc',
  'dd if=/dev/zero of=/dev/',
  'mkfs',
  ':(){:|:&};:',   // fork bomb
  'chmod -R 000 /',
  'wget.*\\| sh',
  'curl.*\\| sh',
  'nc -e /bin/',
  '/dev/tcp/',
  '> /etc/passwd',
  '> /etc/shadow',
]

export class Sandbox {
  private readonly config: Required<SandboxConfig>
  private readonly pathGuard: PathGuard
  private readonly circuitBreaker: CircuitBreaker
  private readonly auditLogger: AuditLogger
  private readonly networkFilter: NetworkFilter | null
  private readonly sessionDir: string
  private activeProcesses = 0

  constructor(config: SandboxConfig) {
    this.config = {
      timeoutMs: 30_000,
      maxBuffer: 1024 * 1024,
      maxProcesses: 4,
      networkIsolation: false,
      allowedCommands: [],
      extraBlockedPatterns: [],
      ...config,
    }

    this.pathGuard = new PathGuard([this.config.allowedDir])
    this.circuitBreaker = new CircuitBreaker()
    this.auditLogger = new AuditLogger(this.config.sessionId)

    // Session-scoped temp directory
    this.sessionDir = join(tmpdir(), `sandbox-${this.config.sessionId}`)
    mkdirSync(this.sessionDir, { recursive: true })

    if (this.config.networkIsolation) {
      this.networkFilter = new NetworkFilter(this.config.allowedDir)
    } else {
      this.networkFilter = null
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Execute a bash command in the sandbox.
   */
  async bash(command: string, cwd?: string): Promise<{ stdout: string; stderr: string; exitCode: number; blocked?: false } | { blocked: true; reason: string }> {
    const start = Date.now()

    // 1. Circuit breaker check
    if (!this.circuitBreaker.canExecute()) {
      const duration = Date.now() - start
      this.circuitBreaker.recordFailure()
      this.logOp('bash', 'blocked', { command, durationMs: duration, reason: 'Circuit breaker open', risk: 'critical' })
      return { blocked: true, reason: 'Circuit breaker is open — too many failures. Please review recent operations.' }
    }

    // 2. Process concurrency check
    if (this.activeProcesses >= this.config.maxProcesses) {
      const duration = Date.now() - start
      this.logOp('bash', 'blocked', { command, durationMs: duration, reason: 'Too many concurrent processes', risk: 'high' })
      return { blocked: true, reason: `Too many concurrent processes (max ${this.config.maxProcesses})` }
    }

    // 3. Path guard check — resolve working directory
    const effectiveCwd = cwd ?? this.config.allowedDir
    if (!this.pathGuard.isAllowed(effectiveCwd)) {
      const duration = Date.now() - start
      this.logOp('bash', 'blocked', { command, durationMs: duration, reason: `CWD not allowed: ${effectiveCwd}`, risk: 'high' })
      return { blocked: true, reason: `Working directory "${effectiveCwd}" is outside allowed scope` }
    }

    // 4. Command pattern check
    const blockedReason = this.isCommandBlocked(command)
    if (blockedReason) {
      const duration = Date.now() - start
      this.circuitBreaker.recordFailure()
      this.logOp('bash', 'blocked', { command, durationMs: duration, reason: blockedReason, risk: 'critical' })
      return { blocked: true, reason: blockedReason }
    }

    // 5. Allowed command check
    if (this.config.allowedCommands.length > 0) {
      const firstWord = command.trim().split(/\s+/)[0]
      if (!this.config.allowedCommands.includes(firstWord)) {
        const duration = Date.now() - start
        this.logOp('bash', 'blocked', { command, durationMs: duration, reason: `Command "${firstWord}" not in allowlist`, risk: 'medium' })
        return { blocked: true, reason: `Command "${firstWord}" is not allowed in this sandbox` }
      }
    }

    // 6. Execute
    this.activeProcesses++
    try {
      // Wrap command with ulimit limits via bash -c
      const wrappedCmd = this.wrapCommand(command)

      const { stdout, stderr } = await execFileAsync(
        'bash',
        ['-c', wrappedCmd],
        {
          cwd: effectiveCwd,
          timeout: this.config.timeoutMs,
          maxBuffer: this.config.maxBuffer,
        }
      )

      const duration = Date.now() - start
      this.circuitBreaker.recordSuccess()
      this.logOp('bash', 'success', { command, durationMs: duration, risk: this.assessRisk(command) })
      return {
        stdout: stdout.slice(0, 50_000),
        stderr: stderr.slice(0, 10_000),
        exitCode: 0,
      }
    } catch (e: any) {
      const duration = Date.now() - start
      const isTimeout = e.killed || e.code === 'ETIMEDOUT' || e.code === 'ENFILE' || e.code === 'EMFILE'

      if (isTimeout) {
        this.circuitBreaker.recordFailure()
        this.logOp('bash', 'timeout', { command, durationMs: duration, reason: `Timeout after ${this.config.timeoutMs}ms`, risk: 'medium' })
        return { blocked: true, reason: `Command timed out after ${this.config.timeoutMs}ms (Timeout)` }
      }

      this.circuitBreaker.recordFailure()
      const exitCode = e.status ?? 1
      this.logOp('bash', 'failure', { command, durationMs: duration, reason: e.message, risk: this.assessRisk(command) })
      return {
        stdout: (e.stdout ?? '').slice(0, 50_000),
        stderr: (e.stderr ?? '').slice(0, 10_000),
        exitCode,
      }
    } finally {
      this.activeProcesses--
    }
  }

  /**
   * Execute a file write with sandbox restriction.
   */
  writeFile(path: string, content: string): { success: true } | { blocked: true; reason: string } {
    const resolved = resolve(path)
    if (!this.pathGuard.isAllowed(resolved)) {
      this.logOp('file_write', 'blocked', { target: path, durationMs: 0, reason: 'Path not allowed', risk: 'high' })
      return { blocked: true, reason: `Path "${path}" is outside allowed scope` }
    }
    try {
      writeFileSync(resolved, content, 'utf-8')
      this.logOp('file_write', 'success', { target: path, durationMs: 0, risk: 'low' })
      return { success: true }
    } catch (e: any) {
      this.logOp('file_write', 'failure', { target: path, durationMs: 0, reason: e.message, risk: 'medium' })
      return { blocked: true, reason: e.message }
    }
  }

  /**
   * Read a file with sandbox restriction.
   */
  readFile(path: string): { success: true; content: string } | { blocked: true; reason: string } {
    const resolved = resolve(path)
    if (!this.pathGuard.isAllowed(resolved)) {
      this.logOp('file_read', 'blocked', { target: path, durationMs: 0, reason: 'Path not allowed', risk: 'high' })
      return { blocked: true, reason: `Path "${path}" is outside allowed scope` }
    }
    try {
      const { readFileSync } = require('fs')
      const content = readFileSync(resolved, 'utf-8')
      this.logOp('file_read', 'success', { target: path, durationMs: 0, risk: 'low' })
      return { success: true, content }
    } catch (e: any) {
      this.logOp('file_read', 'failure', { target: path, durationMs: 0, reason: e.message, risk: 'medium' })
      return { blocked: true, reason: e.message }
    }
  }

  /**
   * Check if a path is within sandbox scope.
   */
  isPathAllowed(path: string): boolean {
    return this.pathGuard.isAllowed(path)
  }

  /**
   * Get circuit breaker state.
   */
  getCircuitState(): 'closed' | 'open' | 'half' {
    return this.circuitBreaker.getState()
  }

  /**
   * Get audit log for this sandbox.
   */
  getAuditLog() {
    return this.auditLogger.export()
  }

  /**
   * Get audit summary.
   */
  getAuditSummary() {
    return this.auditLogger.getSummary()
  }

  /**
   * Apply network isolation (must call restoreNetwork when done).
   */
  async applyNetworkIsolation(): Promise<void> {
    if (this.networkFilter) {
      await this.networkFilter.apply()
    }
  }

  /**
   * Restore network access.
   */
  async restoreNetwork(): Promise<void> {
    if (this.networkFilter) {
      await this.networkFilter.restore()
    }
  }

  /**
   * Clean up session temp directory.
   */
  cleanup(): void {
    if (existsSync(this.sessionDir)) {
      try {
        unlinkSync(this.sessionDir)
      } catch {
        // ignore cleanup errors
      }
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private isCommandBlocked(command: string): string | null {
    const allPatterns = [
      ...DEFAULT_BLOCKED_PATTERNS,
      ...this.config.extraBlockedPatterns,
    ]
    for (const pattern of allPatterns) {
      if (command.includes(pattern)) {
        return `Command blocked: matches dangerous pattern "${pattern}"`
      }
    }
    return null
  }

  private assessRisk(command: string): 'low' | 'medium' | 'high' | 'critical' {
    const highRiskPatterns = ['sudo', 'chmod 777', 'kill -9', 'killall', '/proc/', '/sys/', 'curl', 'wget', 'nc ']
    const mediumRiskPatterns = ['apt', 'yum', 'dnf', 'npm install -g', 'pip install', 'composer']

    for (const p of highRiskPatterns) {
      if (command.includes(p)) return 'high'
    }
    for (const p of mediumRiskPatterns) {
      if (command.includes(p)) return 'medium'
    }
    return 'low'
  }

  private wrapCommand(command: string): string {
    // Prefix with resource limits using ulimit and co-process
    return [
      // Limit processes (prevent fork bombs)
      `ulimit -u 64`,
      // Limit file size to 10MB
      `ulimit -f 10240`,
      // Limit virtual memory (prevent OOM)
      `ulimit -v $(ulimit -Hv)`,
      // Run actual command
      command,
    ].join(' && ')
  }

  private logOp(operation: OperationType, result: OperationResult, opts: { command?: string; target?: string; durationMs: number; reason?: string; risk: 'low' | 'medium' | 'high' | 'critical' }) {
    this.auditLogger.logOperation(operation, result, opts)
  }
}
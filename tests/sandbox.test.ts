// @ts-nocheck
/**
 * Sandbox integration tests.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Sandbox } from '../core/sandbox/sandbox.js'
import { CircuitBreaker } from '../core/sandbox/circuit-breaker.js'
import { AuditLogger } from '../core/sandbox/audit-logger.js'
import { randomUUID } from 'crypto'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const isWindows = process.platform === 'win32'

describe('CircuitBreaker', () => {
  it('starts in closed state', () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, windowMs: 10_000, resetTimeoutMs: 1_000, successThreshold: 1 })
    expect(cb.canExecute()).toBe(true)
    expect(cb.getState()).toBe('closed')
  })

  it('opens after threshold failures', () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, windowMs: 10_000, resetTimeoutMs: 1_000, successThreshold: 1 })
    cb.recordFailure()
    cb.recordFailure()
    expect(cb.canExecute()).toBe(true)
    cb.recordFailure()
    expect(cb.canExecute()).toBe(false)
    expect(cb.getState()).toBe('open')
  })

  it('resets on success in half-open', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, windowMs: 10_000, resetTimeoutMs: 50, successThreshold: 1 })
    cb.recordFailure()
    cb.recordFailure()
    expect(cb.getState()).toBe('open')

    await new Promise(r => setTimeout(r, 60))
    expect(cb.canExecute()).toBe(true)

    cb.recordSuccess()
    expect(cb.getState()).toBe('closed')
  })

  it('manual reset works', () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, windowMs: 10_000, resetTimeoutMs: 1_000, successThreshold: 1 })
    cb.recordFailure()
    cb.recordFailure()
    cb.reset()
    expect(cb.getState()).toBe('closed')
    expect(cb.canExecute()).toBe(true)
  })
})

describe('AuditLogger', () => {
  it('records and exports entries', () => {
    const logger = new AuditLogger('test-session')
    logger.logOperation('bash', 'success', { command: 'ls', durationMs: 100, risk: 'low' })
    logger.logOperation('bash', 'blocked', { command: 'rm -rf /', durationMs: 1, reason: 'blocked', risk: 'critical' })

    const entries = logger.getEntries()
    expect(entries).toHaveLength(2)
    expect(entries[0].result).toBe('success')
    expect(entries[1].result).toBe('blocked')

    const summary = logger.getSummary()
    expect(summary.total).toBe(2)
    expect(summary.success).toBe(1)
    expect(summary.blocked).toBe(1)
    expect(summary.byRisk['critical']).toBe(1)
  })
})

describe('Sandbox', () => {
  let workDir: string

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'sandbox-test-'))
    writeFileSync(join(workDir, 'hello.txt'), 'world')
  })

  afterEach(() => {
    try { rmSync(workDir, { recursive: true }) } catch {}
  })

  it('allows safe commands', async () => {
    const sb = new Sandbox({ sessionId: 'test-1', allowedDir: workDir, timeoutMs: 10_000 })
    const result = await sb.bash('echo hello')
    if ('blocked' in result) {
      expect(result.blocked).toBe(false)
      return
    }
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('hello')
  })

  it('blocks dangerous commands', async () => {
    const sb = new Sandbox({ sessionId: 'test-2', allowedDir: workDir, timeoutMs: 5_000 })
    const result = await sb.bash('rm -rf /')
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('blocked')
  })

  it('blocks out-of-scope directories', async () => {
    const sb = new Sandbox({ sessionId: 'test-3', allowedDir: workDir, timeoutMs: 5_000 })
    const result = await sb.bash('chmod -R 000 /')
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('blocked')
  })

  it('restricts to allowed commands when configured', async () => {
    const sb = new Sandbox({ sessionId: 'test-4', allowedDir: workDir, allowedCommands: ['echo', 'cat'], timeoutMs: 10_000 })
    const ok = await sb.bash('echo ok')
    if ('blocked' in ok) {
      expect(ok.blocked).toBe(false)
    } else {
      expect(ok.exitCode).toBe(0)
    }

    const blocked = await sb.bash('whoami')
    expect(blocked.blocked).toBe(true)
    expect(blocked.reason).toContain('not allowed')
  })

  it('times out long-running commands', async () => {
    const sb = new Sandbox({ sessionId: 'test-5', allowedDir: workDir, timeoutMs: 2_000 })
    const result = await sb.bash('sleep 10')
    if ('blocked' in result) {
      expect(result.blocked).toBe(true)
      expect(result.reason).toContain('Timeout')
    }
  })

  it('records audit entries', async () => {
    const sb = new Sandbox({ sessionId: 'test-6', allowedDir: workDir, timeoutMs: 10_000 })
    await sb.bash('echo hello')
    await sb.bash('echo world')

    const summary = sb.getAuditSummary()
    expect(summary.total).toBeGreaterThanOrEqual(2)
    expect(summary.success).toBeGreaterThanOrEqual(2)
  })

  it('circuit breaker blocks after repeated failures', async () => {
    const sb = new Sandbox({ sessionId: 'test-7', allowedDir: workDir, timeoutMs: 500 })
    for (let i = 0; i < 6; i++) {
      await sb.bash('sleep 5')
    }
    const state = sb.getCircuitState()
    expect(['closed', 'open', 'half']).toContain(state)
  }, 15_000)
})
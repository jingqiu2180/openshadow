// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { existsSync, rmSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('UsageTracker', () => {
  let dataDir: string
  let UsageTracker: typeof import('../../core/providers/usage-tracker.js').UsageTracker

  beforeEach(async () => {
    vi.resetModules()
    dataDir = join(tmpdir(), `openshadow-test-usage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
    mkdirSync(dataDir, { recursive: true })
    process.env.REMO_DATA_DIR = dataDir
    const mod = await import('../../core/providers/usage-tracker.js')
    UsageTracker = mod.UsageTracker
  })

  afterEach(() => {
    // Windows 文件锁：重试 + force 删除
    if (existsSync(dataDir)) {
      for (let i = 0; i < 3; i++) {
        try { rmSync(dataDir, { recursive: true, force: true, maxRetries: 3 }); break; }
        catch { /* retry */ }
      }
    }
  })

  it('should record usage', () => {
    const tracker = new UsageTracker()
    tracker.record({
      providerId: 'openai',
      model: 'gpt-4',
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      latencyMs: 1200,
      sessionId: 'session-1',
    })

    const total = tracker.getTotalUsage()
    expect(total.totalTokens).toBe(150)
    expect(total.totalRequests).toBe(1)
  })

  it('should record multiple usage entries', () => {
    const tracker = new UsageTracker()
    tracker.record({
      providerId: 'openai', model: 'gpt-4', promptTokens: 100, completionTokens: 50, totalTokens: 150, latencyMs: 1000, sessionId: 's1',
    })
    tracker.record({
      providerId: 'openai', model: 'gpt-4', promptTokens: 200, completionTokens: 100, totalTokens: 300, latencyMs: 2000, sessionId: 's1',
    })
    tracker.record({
      providerId: 'gemini', model: 'gemini-pro', promptTokens: 50, completionTokens: 25, totalTokens: 75, latencyMs: 500, sessionId: 's2',
    })

    const total = tracker.getTotalUsage()
    expect(total.totalTokens).toBe(525)
    expect(total.totalRequests).toBe(3)
  })

  it('should filter total usage by provider', () => {
    const tracker = new UsageTracker()
    tracker.record({
      providerId: 'openai', model: 'gpt-4', promptTokens: 100, completionTokens: 50, totalTokens: 150, latencyMs: 1000, sessionId: 's1',
    })
    tracker.record({
      providerId: 'gemini', model: 'gemini-pro', promptTokens: 50, completionTokens: 25, totalTokens: 75, latencyMs: 500, sessionId: 's2',
    })

    const openaiTotal = tracker.getTotalUsage('openai')
    expect(openaiTotal.totalTokens).toBe(150)
    expect(openaiTotal.totalRequests).toBe(1)

    const geminiTotal = tracker.getTotalUsage('gemini')
    expect(geminiTotal.totalTokens).toBe(75)
    expect(geminiTotal.totalRequests).toBe(1)
  })

  it('should get summary by period', () => {
    const tracker = new UsageTracker()
    tracker.record({
      providerId: 'openai', model: 'gpt-4', promptTokens: 100, completionTokens: 50, totalTokens: 150, latencyMs: 1000, sessionId: 's1',
    })
    tracker.record({
      providerId: 'openai', model: 'gpt-4', promptTokens: 200, completionTokens: 100, totalTokens: 300, latencyMs: 2000, sessionId: 's1',
    })

    const summary = tracker.getSummary('day')
    expect(summary.length).toBeGreaterThanOrEqual(1)

    const openaiSummary = summary.find(s => s.providerId === 'openai')
    expect(openaiSummary).toBeDefined()
    expect(openaiSummary!.totalRequests).toBe(2)
    expect(openaiSummary!.totalTokens).toBe(450)
    expect(openaiSummary!.avgLatencyMs).toBe(1500)
  })

  it('should filter summary by provider', () => {
    const tracker = new UsageTracker()
    tracker.record({
      providerId: 'openai', model: 'gpt-4', promptTokens: 100, completionTokens: 50, totalTokens: 150, latencyMs: 1000, sessionId: 's1',
    })
    tracker.record({
      providerId: 'gemini', model: 'gemini-pro', promptTokens: 50, completionTokens: 25, totalTokens: 75, latencyMs: 500, sessionId: 's2',
    })

    const summary = tracker.getSummary('day', 'openai')
    expect(summary.length).toBe(1)
    expect(summary[0].providerId).toBe('openai')
    expect(summary[0].totalTokens).toBe(150)
  })

  it('should cleanup old logs', () => {
    const tracker = new UsageTracker()
    tracker.record({
      providerId: 'openai', model: 'gpt-4', promptTokens: 100, completionTokens: 50, totalTokens: 150, latencyMs: 1000, sessionId: 's1',
    })

    const deleted = tracker.cleanupOldLogs(0)
    expect(deleted).toBeGreaterThanOrEqual(0)
  })

  it('should return zero for empty usage', () => {
    const tracker = new UsageTracker()
    const total = tracker.getTotalUsage()
    expect(total.totalTokens).toBe(0)
    expect(total.totalRequests).toBe(0)
  })

  it('should return empty summary for empty usage', () => {
    const tracker = new UsageTracker()
    const summary = tracker.getSummary('day')
    expect(summary).toEqual([])
  })
})

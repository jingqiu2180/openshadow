// @ts-nocheck
export interface Metrics {
  uptime: number
  memoryUsage: {
    used: number
    total: number
  }
  requests: {
    total: number
    success: number
    error: number
  }
  agent: {
    chats: number
    toolCalls: number
    avgResponseTime: number
  }
  storage: {
    totalMemories: number
    avgImportance: number
  }
}

export class MetricsCollector {
  private startTime: number = Date.now()
  private requestCount: number = 0
  private successCount: number = 0
  private errorCount: number = 0
  private chatCount: number = 0
  private toolCallCount: number = 0
  private responseTimes: number[] = []

  recordRequest(success: boolean): void {
    this.requestCount++
    if (success) this.successCount++
    else this.errorCount++
  }

  recordChat(responseTime: number): void {
    this.chatCount++
    this.responseTimes.push(responseTime)
    if (this.responseTimes.length > 100) this.responseTimes.shift()
  }

  recordToolCall(): void {
    this.toolCallCount++
  }

  get(): Metrics {
    const mem = process.memoryUsage()
    const avgResponseTime = this.responseTimes.length > 0
      ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
      : 0

    return {
      uptime: Date.now() - this.startTime,
      memoryUsage: { used: mem.heapUsed, total: mem.heapTotal },
      requests: { total: this.requestCount, success: this.successCount, error: this.errorCount },
      agent: { chats: this.chatCount, toolCalls: this.toolCallCount, avgResponseTime },
      storage: { totalMemories: 0, avgImportance: 0 },
    }
  }

  reset(): void {
    this.startTime = Date.now()
    this.requestCount = 0
    this.successCount = 0
    this.errorCount = 0
    this.chatCount = 0
    this.toolCallCount = 0
    this.responseTimes = []
  }
}

export function createMetricsCollector(): MetricsCollector {
  return new MetricsCollector()
}

export const metrics = createMetricsCollector()
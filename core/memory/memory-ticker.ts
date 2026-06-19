// @ts-nocheck
/**
 * Memory Ticker — 简化版记忆调度器
 *
 * 功能：
 * - 每日执行一次（可配置）
 * - 调用 DeepMemoryProcessor 提取事实
 */

import { DeepMemoryManager } from './deep-memory';
import { cleanupOldFacts, type CleanupResult } from './memory-cleanup';

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 小时

export interface MemoryTickerOptions {
  /** 执行间隔（毫秒），默认 24 小时 */
  intervalMs?: number;
  /** 是否启用 */
  enabled?: boolean;
  /** 是否在每次 tick 跑 cleanup（默认 true） */
  cleanupEnabled?: boolean;
}

export interface TickResult {
  processed: number;
  cleanup: CleanupResult | null;
}

export class MemoryTicker {
  private intervalMs: number;
  private enabled: boolean;
  private cleanupEnabled: boolean;
  private intervalId: NodeJS.Timeout | null = null;
  private processor: DeepMemoryManager;
  private isRunning: boolean = false;

  constructor(opts: MemoryTickerOptions = {}) {
    this.intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.enabled = opts.enabled ?? true;
    this.cleanupEnabled = opts.cleanupEnabled ?? true;
    this.processor = new DeepMemoryManager();
  }

  /**
   * 启动 Memory Ticker
   */
  start(): void {
    if (!this.enabled) {
      console.log("[memory-ticker] Memory Ticker is disabled");
      return;
    }

    if (this.intervalId) {
      console.warn("[memory-ticker] Memory Ticker is already running");
      return;
    }

    console.log(`[memory-ticker] Starting Memory Ticker (interval: ${this.intervalMs}ms)`);

    // 立即执行一次
    this.run().catch((err) => {
      console.error("[memory-ticker] Initial run failed:", err);
    });

    // 定时执行
    this.intervalId = setInterval(() => {
      this.run().catch((err) => {
        console.error("[memory-ticker] Scheduled run failed:", err);
      });
    }, this.intervalMs);
  }

  /**
   * 停止 Memory Ticker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[memory-ticker] Memory Ticker stopped");
    }
  }

  /**
   * 执行一次记忆处理
   * @param {object} [client] - OpenAI compatible client（可选，未提供则跳过 fact extraction）
   * @param {string} [model] - 模型名称
   * @returns {Promise<TickResult>} 处理结果（processed sessions + cleanup stats）
   */
  async run(client?, model?): Promise<TickResult> {
    if (this.isRunning) {
      console.warn("[memory-ticker] Memory Ticker is already running, skipping");
      return { processed: 0, cleanup: null };
    }

    this.isRunning = true;
    console.log("[memory-ticker] Memory Ticker started");

    let processed = 0;
    let cleanup: CleanupResult | null = null;

    try {
      // 1. Cleanup 永远先跑（不依赖 LLM；importance >= 4 自动豁免）
      if (this.cleanupEnabled) {
        try {
          cleanup = cleanupOldFacts();
        } catch (err) {
          console.error("[memory-ticker] Cleanup failed:", (err as Error).message);
        }
      }

      // 2. Fact extraction 需要 LLM client
      if (client) {
        try {
          processed = await this.processor.processDirtySessions(
            client,
            model ?? "gpt-4o-mini"
          );
        } catch (err) {
          console.error("[memory-ticker] Fact extraction failed:", (err as Error).message);
        }
      } else {
        console.log("[memory-ticker] No LLM client provided, skipping fact extraction");
      }

      console.log(
        `[memory-ticker] Memory Ticker completed: processed ${processed} sessions, ` +
        `cleanup deleted ${cleanup?.deleted ?? 0} facts`
      );
      return { processed, cleanup };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 手动触发一次记忆处理
   */
  async trigger(): Promise<TickResult> {
    return await this.run();
  }

  /**
   * 获取状态
   */
  getStatus(): { enabled: boolean; isRunning: boolean; hasInterval: boolean } {
    return {
      enabled: this.enabled,
      isRunning: this.isRunning,
      hasInterval: this.intervalId !== null,
    };
  }
}

/**
 * 创建 Memory Ticker 实例
 */
export function createMemoryTicker(opts: MemoryTickerOptions = {}): MemoryTicker {
  return new MemoryTicker(opts);
}

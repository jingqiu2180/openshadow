// @ts-nocheck
/**
 * memory-manager.ts — remu 记忆系统管理器
 *
 * 集成 SessionSummaryManager + MemoryCompiler + DeepMemoryManager
 * 参考 openhanako 的 MemoryTicker，但简化实现
 *
 * 触发时机：
 * 1. Session 压缩后 → 保存摘要
 * 2. Session 结束时 → 编译 daily 记忆
 * 3. 每天一次 → 编译 weekly + longterm + 深度记忆
 */

import { SessionSummaryManager } from './session-summary';
import { MemoryCompiler } from './compile';
import { DeepMemoryManager } from './deep-memory';
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEMORY_DIR = path.join(__dirname, "..", "data", "memory");

/**
 * @typedef {object} MemoryConfig
 * @property {string} [memoryDir] - 记忆目录路径
 * @property {string} [model] - 使用的模型（用于摘要生成、编译等）
 * @property {number} [turnsPerSummary] - 每隔多少轮触发一次摘要（默认 10）
 */

export class MemoryManager {
  /** @type {SessionSummaryManager} */
  summaryManager;

  /** @type {MemoryCompiler} */
  compiler;

  /** @type {DeepMemoryManager} */
  deepMemory;

  /** @type {string} */
  memoryDir;

  /** @type {string} */
  model;

  /** @type {number} */
  turnsPerSummary;

  /** @type {string|null} */
  lastCompileDate = null;

  /** @type {number} */
  turnCounter = 0;

  /**
   * @param {object} opts
   * @param {string} [opts.memoryDir]
   * @param {string} [opts.model]
   * @param {number} [opts.turnsPerSummary]
   */
  constructor(opts = {}) {
    this.memoryDir = opts.memoryDir || MEMORY_DIR;
    this.model = opts.model || "gpt-4o-mini";
    this.turnsPerSummary = opts.turnsPerSummary || 10;

    // 创建目录
    fs.mkdirSync(path.join(this.memoryDir, "summaries"), { recursive: true });
    fs.mkdirSync(path.join(this.memoryDir, "daily"), { recursive: true });
    fs.mkdirSync(path.join(this.memoryDir, "weekly"), { recursive: true });
    fs.mkdirSync(path.join(this.memoryDir, "longterm"), { recursive: true });
    fs.mkdirSync(path.join(this.memoryDir, "facts"), { recursive: true });

    // 初始化管理器
    this.summaryManager = new SessionSummaryManager(
      path.join(this.memoryDir, "summaries")
    );
    this.compiler = new MemoryCompiler(this.memoryDir, this.summaryManager);
    this.deepMemory = new DeepMemoryManager(this.memoryDir, this.summaryManager);
  }

  // ══════════════════════════
  //  事件处理（由 SessionManager 调用）
  // ══════════════════════════

  /**
   * 处理 session 压缩（在 SessionCompactor.compact() 之后调用）
   * @param {string} sessionId
   * @param {string} summary - 压缩后的摘要
   * @param {object} client - OpenAI compatible client
   */
  async onSessionCompact(sessionId, summary, client) {
    // 保存摘要
    const now = new Date().toISOString();
    const data = this.summaryManager.getSummary(sessionId) || {
      sessionId,
      created_at: now,
    };
    data.summary = summary;
    data.updated_at = now;
    this.summaryManager.saveSummary(sessionId, data);

    // 增加 turn 计数
    this.turnCounter++;

    // 每隔 N 轮触发一次编译
    if (this.turnCounter >= this.turnsPerSummary) {
      this.turnCounter = 0;
      await this._compileDaily(client);
    }
  }

  /**
   * 处理 session 结束（可选）
   * @param {string} sessionId
   * @param {object} client - OpenAI compatible client
   */
  async onSessionEnd(sessionId, client) {
    // 最终编译一次
    await this._compileDaily(client);

    // 处理深度记忆（如果到了新的一天）
    const today = new Date().toISOString().split("T")[0];
    if (today !== this.lastCompileDate) {
      await this._compileWeeklyAndLongterm(client);
      this.lastCompileDate = today;
    }
  }

  // ══════════════════════════
  //  记忆注入（供 ChatEngine 使用）
  // ══════════════════════════

  /**
   * 获取编译后的记忆（用于注入到 system prompt）
   * @param {string} [type] - "daily" | "weekly" | "longterm"
   * @returns {string}
   */
  getCompiledMemory(type = "longterm") {
    const fp = path.join(this.memoryDir, type, type === "longterm" ? "latest.md" : `${new Date().toISOString().split("T")[0]}.md`);
    try {
      return fs.readFileSync(fp, "utf-8");
    } catch {
      return "";
    }
  }

  /**
   * 搜索相关记忆
   * @param {string} query - 搜索关键词
   * @returns {Array}
   */
  searchMemory(query) {
    return this.deepMemory.searchFacts(query);
  }

  // ══════════════════════════
  //  内部方法
  // ══════════════════════════

  /**
   * 编译 daily 记忆
   */
  async _compileDaily(client) {
    const today = new Date().toISOString().split("T")[0];
    try {
      await this.compiler.compileDaily(today, client, this.model);
    } catch (err) {
      console.error("[MemoryManager] Failed to compile daily memory:", err.message);
    }
  }

  /**
   * 编译 weekly + longterm 记忆，并处理深度记忆
   */
  async _compileWeeklyAndLongterm(client) {
    try {
      // 计算本周一
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() + 1);
      const weekStartStr = weekStart.toISOString().split("T")[0];

      // 编译 weekly
      await this.compiler.compileWeekly(weekStartStr, client, this.model);

      // 编译 longterm
      await this.compiler.compileLongterm(client, "gpt-4o");

      // 处理深度记忆
      await this.deepMemory.processDirtySessions(client, this.model);

      console.log("[MemoryManager] Weekly + longterm compilation completed");
    } catch (err) {
      console.error("[MemoryManager] Failed to compile weekly/longterm memory:", err.message);
    }
  }
}

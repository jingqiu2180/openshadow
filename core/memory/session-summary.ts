// @ts-nocheck
/**
 * session-summary.ts — Session 摘要管理（remu 版）
 *
 * 每个 session 一个 JSON 文件（存在 memory/summaries/ 下）
 * 摘要通过 LLM 生成，格式为 facts + timeline 两节
 *
 * 与 openhanako 的区别：
 * - 简化缓存机制（remu 规模较小）
 * - 使用 remu 的 OpenAI SDK 调用方式
 * - 去掉复杂的 i18n 和 timezone 处理
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { atomicWriteSync } from '../shared/safe-fs';
import { createModuleLogger } from '../debug-log';

const log = createModuleLogger("session-summary");

/**
 * @typedef {object} SessionSummary
 * @property {string} sessionId
 * @property {string} created_at
 * @property {string} updated_at
 * @property {string} summary - 滚动摘要（facts + timeline 格式）
 * @property {string} [snapshot] - 深度记忆处理的快照
 * @property {string} [snapshot_at] - 快照时间
 */

export class SessionSummaryManager {
  /** @type {string} */
  summariesDir;

  /** @type {Map<string, any>} */
  _cache = new Map();

  /** @type {boolean} */
  _cachePopulated = false;

  /**
   * @param {string} [summariesDir] - summaries/ 目录的绝对路径（可选，默认：../data/memory/summaries/）
   */
  constructor(summariesDir) {
    if (!summariesDir) {
      // 默认路径：从 core/memory/ 往上两级，到 data/memory/summaries/
      const currentFilePath = fileURLToPath(import.meta.url)
      const defaultDir = path.join(path.dirname(currentFilePath), '..', '..', 'data', 'memory', 'summaries')
      summariesDir = defaultDir
    }
    this.summariesDir = summariesDir;
    fs.mkdirSync(summariesDir, { recursive: true });
  }

  // ═══════════════════════════
  //  读写
  // ═══════════════════════════

  /**
   * 读取指定 session 的摘要
   * @param {string} sessionId
   * @returns {SessionSummary|null}
   */
  getSummary(sessionId) {
    if (this._cache.has(sessionId)) return this._cache.get(sessionId);
    const fp = this._filePath(sessionId);
    try {
      const data = JSON.parse(fs.readFileSync(fp, "utf-8"));
      this._cache.set(sessionId, data);
      return data;
    } catch {
      return null;
    }
  }

  /**
   * 写入摘要（原子写入）
   * @param {string} sessionId
   * @param {SessionSummary} data
   */
  saveSummary(sessionId, data) {
    const fp = this._filePath(sessionId);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    atomicWriteSync(fp, JSON.stringify(data, null, 2) + "\n");
    this._cache.set(sessionId, data);
  }

  /**
   * 生成文件路径
   * @param {string} sessionId
   * @returns {string}
   */
  _filePath(sessionId) {
    return path.join(this.summariesDir, `${sessionId}.json`);
  }

  // ═══════════════════════════
  //  脏 session 追踪（供深度记忆用）
  // ═══════════════════════════

  /**
   * 获取所有"脏" session（summary !== snapshot）
   * @returns {Array<SessionSummary>}
   */
  getDirtySessions(opts = {}) {
    this._ensureCachePopulated();
    const dirty = [];
    for (const data of this._cache.values()) {
      if (!data?.summary) continue;
      if (data.summary !== (data.snapshot || "")) {
        dirty.push(data);
      }
    }
    return dirty;
  }

  /**
   * 标记 session 已被深度记忆处理（snapshot = summary）
   * @param {string} sessionId
   */
  markProcessed(sessionId) {
    const data = this.getSummary(sessionId);
    if (!data) return;

    data.snapshot = data.summary;
    data.snapshot_at = new Date().toISOString();
    this.saveSummary(sessionId, data);
  }

  // ═══════════════════════════
  //  查询
  // ═══════════════════════════

  /**
   * 获取所有摘要（按 updated_at 降序）
   * @returns {Array<SessionSummary>}
   */
  getAllSummaries() {
    this._ensureCachePopulated();
    const summaries = [];
    for (const data of this._cache.values()) {
      if (data?.summary) summaries.push(data);
    }
    summaries.sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
    return summaries;
  }

  /**
   * 首次调用时做一次全量扫描填充缓存
   */
  _ensureCachePopulated() {
    if (this._cachePopulated) return;
    const files = this._listFiles();
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(file, "utf-8"));
        if (data.sessionId) {
          this._cache.set(data.sessionId, data);
        }
      } catch {
        // 跳过损坏的文件
      }
    }
    this._cachePopulated = true;
  }

  /**
   * 列出所有摘要文件
   * @returns {Array<string>}
   */
  _listFiles() {
    try {
      return fs.readdirSync(this.summariesDir)
        .filter(f => f.endsWith(".json"))
        .map(f => path.join(this.summariesDir, f));
    } catch {
      return [];
    }
  }

  // ═══════════════════════════
  //  生成摘要（核心功能）
  // ═══════════════════════════

  /**
   * 生成 session 摘要（调用 LLM）
   * @param {string} sessionId
   * @param {Array} messages - 对话消息数组
   * @param {object} client - OpenAI compatible client instance
   * @param {string} model - 模型名称
   * @param {string} [existingSummary] - 已有摘要（用于滚动更新）
   */
  async generateSummary(sessionId, messages, client, model = "gpt-4o-mini", existingSummary = "") {
    const prompt = this._buildSummaryPrompt(messages, existingSummary);

    try {
      const response = await client.chat.completions.create({
        model: model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1000,
      });

      const summary = response.choices[0]?.message?.content || "";

      // 保存摘要
      const now = new Date().toISOString();
      const data = this.getSummary(sessionId) || {
        sessionId,
        created_at: now,
      };
      data.summary = summary;
      data.updated_at = now;
      this.saveSummary(sessionId, data);

      log.info(`Generated summary for session ${sessionId}`);
      return summary;
    } catch (err) {
      log.error(`Failed to generate summary for session ${sessionId}: ${err.message}`);
      return existingSummary; // 失败时返回已有摘要
    }
  }

  /**
   * 构建摘要生成 prompt
   * @param {Array} messages
   * @param {string} existingSummary
   * @returns {string}
   */
  _buildSummaryPrompt(messages, existingSummary) {
    const conversationText = messages
      .filter(m => m.role !== "system")
      .map(m => `${m.role}: ${m.content}`)
      .join("\n");

    let prompt = `请对以下对话生成一个结构化摘要。\n\n`;
    prompt += `要求：\n`;
    prompt += `1. facts 节：提取关键事实、决策、偏好（每行一个事实）\n`;
    prompt += `2. timeline 节：按时间顺序列出重要事件\n\n`;

    if (existingSummary) {
      prompt += `已有摘要：\n${existingSummary}\n\n`;
      prompt += `请基于已有摘要和 новы对话内容，生成更新后的摘要。\n\n`;
    }

    prompt += `对话内容：\n${conversationText}\n\n`;
    prompt += `输出格式：\n`;
    prompt += `## facts\n- 事实1\n- 事实2\n\n`;
    prompt += `## timeline\n- YYYY-MM-DD: 事件1\n- YYYY-MM-DD: 事件2\n`;

    return prompt;
  }
}

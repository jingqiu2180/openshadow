// @ts-nocheck
/**
 * compile.ts — 记忆编译器（remu 版）
 *
 * 将 session 摘要编译成长期记忆（daily/weekly/longterm）
 *
 * 设计思路：
 * - 简化自 openhanako，但使用 Markdown 格式（易于阅读）
 * - 三层记忆：daily（每天）→ weekly（每周）→ longterm（长期）
 * - 每层编译都会读取下层记忆，生成更高层次的抽象
 */

import fs from "fs";
import path from "path";
import { atomicWriteSync } from '../../shared/safe-fs.js';
import { createModuleLogger } from '../debug-log.js';
import { SessionSummaryManager } from './session-summary.js';

const log = createModuleLogger("memory-compile");

export class MemoryCompiler {
  /** @type {string} */
  memoryDir;

  /** @type {SessionSummaryManager} */
  summaryManager;

  /**
   * @param {string} memoryDir - memory/ 目录的绝对路径
   * @param {SessionSummaryManager} summaryManager
   */
  constructor(memoryDir, summaryManager) {
    this.memoryDir = memoryDir;
    this.summaryManager = summaryManager;

    // 创建必要的子目录
    const subdirs = ["daily", "weekly", "longterm"];
    for (const dir of subdirs) {
      fs.mkdirSync(path.join(memoryDir, dir), { recursive: true });
    }
  }

  // ══════════════════════════
  //  编译：daily（每日记忆）
  // ══════════════════════════

  /**
   * 编译指定日期的 daily 记忆
   * @param {string} date - YYYY-MM-DD
   * @param {object} client - OpenAI compatible client
   * @param {string} [model] - 模型名称
   * @returns {Promise<string>} 编译后的内容
   */
  async compileDaily(date, client, model = "gpt-4o-mini") {
    const summaries = this._getSummariesForDate(date);

    if (summaries.length === 0) {
      log.info(`No summaries for ${date}, skipping daily compile`);
      return "";
    }

    const existingContent = this._readCompiled("daily", date);
    const prompt = this._buildCompilePrompt(summaries, existingContent, "daily");

    try {
      const response = await client.chat.completions.create({
        model: model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content || "";
      this._saveCompiled("daily", date, content, summaries.map(s => s.sessionId));

      log.info(`Compiled daily memory for ${date} (${summaries.length} sessions)`);
      return content;
    } catch (err) {
      log.error(`Failed to compile daily memory for ${date}: ${err.message}`);
      return existingContent;
    }
  }

  // ══════════════════════════
  //  编译：weekly（每周记忆）
  // ══════════════════════════

  /**
   * 编译指定周的 weekly 记忆
   * @param {string} weekStart - YYYY-MM-DD（周一）
   * @param {object} client - OpenAI compatible client
   * @param {string} [model] - 模型名称
   * @returns {Promise<string>}
   */
  async compileWeekly(weekStart, client, model = "gpt-4o-mini") {
    const dayMs = 86400000;
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setTime(d.getTime() + i * dayMs);
      dates.push(d.toISOString().split("T")[0]);
    }

    const dailyContents = dates
      .map(d => this._readCompiled("daily", d))
      .filter(Boolean);

    if (dailyContents.length === 0) {
      log.info(`No daily memories for week ${weekStart}, skipping weekly compile`);
      return "";
    }

    const existingContent = this._readCompiled("weekly", weekStart);
    const prompt = this._buildWeeklyPrompt(dailyContents, existingContent);

    try {
      const response = await client.chat.completions.create({
        model: model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content || "";
      this._saveCompiled("weekly", weekStart, content, []);

      log.info(`Compiled weekly memory for week ${weekStart}`);
      return content;
    } catch (err) {
      log.error(`Failed to compile weekly memory for ${weekStart}: ${err.message}`);
      return existingContent;
    }
  }

  // ══════════════════════════
  //  编译：longterm（长期记忆）
  // ══════════════════════════

  /**
   * 编译长期记忆（从 daily + weekly 汇总）
   * @param {object} client - OpenAI compatible client
   * @param {string} [model] - 模型名称
   * @returns {Promise<string>}
   */
  async compileLongterm(client, model = "gpt-4o") {
    const dailyDir = path.join(this.memoryDir, "daily");
    const weeklyDir = path.join(this.memoryDir, "weekly");

    const dailyFiles = fs.readdirSync(dailyDir)
      .filter(f => f.endsWith(".md"))
      .sort()
      .reverse()
      .slice(0, 30); // 最近30天

    const weeklyFiles = fs.readdirSync(weeklyDir)
      .filter(f => f.endsWith(".md"))
      .sort()
      .reverse()
      .slice(0, 8); // 最近8周

    const contents = [];
    for (const f of dailyFiles) {
      contents.push(fs.readFileSync(path.join(dailyDir, f), "utf-8"));
    }
    for (const f of weeklyFiles) {
      contents.push(fs.readFileSync(path.join(weeklyDir, f), "utf-8"));
    }

    if (contents.length === 0) {
      log.info("No daily/weekly memories, skipping longterm compile");
      return "";
    }

    const existingContent = this._readCompiled("longterm", "latest");
    const prompt = this._buildLongtermPrompt(contents, existingContent);

    try {
      const response = await client.chat.completions.create({
        model: model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 4000,
      });

      const content = response.choices[0]?.message?.content || "";
      this._saveCompiled("longterm", "latest", content, []);

      log.info("Compiled longterm memory");
      return content;
    } catch (err) {
      log.error(`Failed to compile longterm memory: ${err.message}`);
      return existingContent;
    }
  }

  // ══════════════════════════
  //  读取/保存编译后的记忆
  // ══════════════════════════

  /**
   * 读取编译后的记忆
   * @param {string} type - daily/weekly/longterm
   * @param {string} key - 日期或 "latest"
   * @returns {string}
   */
  _readCompiled(type, key) {
    const fp = path.join(this.memoryDir, type, `${key}.md`);
    try {
      return fs.readFileSync(fp, "utf-8");
    } catch {
      return "";
    }
  }

  /**
   * 保存编译后的记忆
   * @param {string} type
   * @param {string} key
   * @param {string} content
   * @param {string[]} sourceSessions
   */
  _saveCompiled(type, key, content, sourceSessions) {
    const fp = path.join(this.memoryDir, type, `${key}.md`);
    const header = `---
source: ${type}
date: ${key}
source_sessions: ${JSON.stringify(sourceSessions)}
---\n\n`;
    atomicWriteSync(fp, header + content);
  }

  /**
   * 获取指定日期的所有摘要
   * @param {string} date - YYYY-MM-DD
   * @returns {Array}
   */
  _getSummariesForDate(date) {
    return this.summaryManager.getAllSummaries().filter(s => {
      const d = (s.updated_at || s.created_at || "").split("T")[0];
      return d === date;
    });
  }

  // ══════════════════════════
  //  Prompt 构建
  // ══════════════════════════

  /**
   * 构建编译 prompt（daily）
   */
  _buildCompilePrompt(summaries, existingContent, type) {
    let prompt = `请将以下 ${summaries.length} 个 session 摘要编译成结构化的${type}记忆。\n\n`;

    if (existingContent) {
      prompt += `已有${type}记忆：\n${existingContent}\n\n`;
      prompt += `请基于已有记忆和新摘要，生成更新后的记忆。\n\n`;
    }

    prompt += `新摘要：\n`;
    for (const s of summaries) {
      prompt += `---\nSession: ${s.sessionId}\n${s.summary}\n\n`;
    }

    prompt += `\n输出要求：\n`;
    prompt += `1. 提取关键事实、决策、用户偏好\n`;
    prompt += `2. 按主题分类组织\n`;
    prompt += `3. 保持简洁，去除冗余\n`;
    prompt += `4. 使用 Markdown 格式\n`;

    return prompt;
  }

  /**
   * 构建编译 prompt（weekly）
   */
  _buildWeeklyPrompt(dailyContents, existingContent) {
    let prompt = `请将以下7天的 daily 记忆编译成 weekly 记忆。\n\n`;

    if (existingContent) {
      prompt += `已有 weekly 记忆：\n${existingContent}\n\n`;
    }

    prompt += `Daily 记忆：\n${dailyContents.join("\n---\n")}\n\n`;
    prompt += `输出要求：提炼本周主题、重要决策、模式识别。\n`;

    return prompt;
  }

  /**
   * 构建编译 prompt（longterm）
   */
  _buildLongtermPrompt(contents, existingContent) {
    let prompt = `请将以下 daily 和 weekly 记忆编译成长期记忆。\n\n`;

    if (existingContent) {
      prompt += `已有长期记忆：\n${existingContent}\n\n`;
    }

    prompt += `记忆内容：\n${contents.join("\n---\n")}\n\n`;
    prompt += `输出要求：\n`;
    prompt += `1. 识别跨周的模式和趋势\n`;
    prompt += `2. 提取持久的用户特征和偏好\n`;
    prompt += `3. 记录重要项目和决策\n`;
    prompt += `4. 保持结构化，易于检索\n`;

    return prompt;
  }
}

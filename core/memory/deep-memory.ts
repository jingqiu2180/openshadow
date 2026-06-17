// @ts-nocheck
/**
 * deep-memory.ts — 深度记忆系统（remu 版）
 *
 * 从 session 摘要中提取结构化事实（元事实）
 * 这些事实存储在 memory/facts/ 下，供长期检索使用
 *
 * 与 openhanako 的区别：
 * - 简化事实提取逻辑
 * - 使用 remu 的 LLM 调用方式
 * - 去掉复杂的快照对比逻辑
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createModuleLogger } from "../debug-log.js";
import { SessionSummaryManager } from "./session-summary.js";

const log = createModuleLogger("deep-memory");

/**
 * @typedef {object} MetaFact
 * @property {string} id - 事实 ID（UUID）
 * @property {string} content - 事实内容
 * @property {string[]} tags - 标签
 * @property {string} sourceSession - 来源 session
 * @property {string} created_at - 创建时间
 * @property {number} confidence - 置信度 (0-1)
 */

export class DeepMemoryManager {
  /** @type {string} */
  factsDir;

  /** @type {SessionSummaryManager} */
  summaryManager;

  /**
   * @param {string} [memoryDir] - memory/ 目录的绝对路径（可选，默认自动计算）
   * @param {SessionSummaryManager} [summaryManager] - SessionSummaryManager 实例（可选，默认自动创建）
   */
  constructor(memoryDir, summaryManager) {
    if (!memoryDir) {
      // 默认路径：从 core/memory/ 往上两级，到 data/memory/
      const currentFilePath = fileURLToPath(import.meta.url)
      memoryDir = path.join(path.dirname(currentFilePath), '..', '..', 'data', 'memory')
    }
    this.factsDir = path.join(memoryDir, "facts");
    
    if (!summaryManager) {
      summaryManager = new SessionSummaryManager();
    }
    this.summaryManager = summaryManager;
    
    fs.mkdirSync(this.factsDir, { recursive: true });
  }

  // ══════════════════════════
  //  处理脏 session（核心功能）
  // ══════════════════════════

  /**
   * 处理所有脏 session（摘要已更新但未见光）
   * @param {object} client - OpenAI compatible client
   * @param {string} [model] - 模型名称
   * @returns {Promise<number>} 处理了的 session 数量
   */
  async processDirtySessions(client, model = "gpt-4o-mini") {
    const dirty = this.summaryManager.getDirtySessions();
    log.info(`Found ${dirty.length} dirty sessions`);

    let processed = 0;
    for (const data of dirty) {
      try {
        await this._processSession(data, client);
        this.summaryManager.markProcessed(data.sessionId);
        processed++;
      } catch (err) {
        log.error(`Failed to process session ${data.sessionId}: ${err.message}`);
      }
    }

    return processed;
  }

  /**
   * 处理单个 session
   * @param {object} sessionData
   * @param {object} client
   */
  async _processSession(sessionData, client) {
    const { sessionId, summary } = sessionData;
    log.info(`Processing session ${sessionId} for deep memory`);

    // 调用 LLM 提取元事实
    const facts = await this._extractFacts(summary, sessionId, client);

    // 保存事实
    for (const fact of facts) {
      this._saveFact(fact);
    }

    log.info(`Extracted ${facts.length} facts from session ${sessionId}`);
  }

  /**
   * 从摘要中提取元事实
   * @param {string} summary - session 摘要
   * @param {string} sessionId
   * @param {object} client - OpenAI compatible client
   * @param {string} [model] - 模型名称
   * @returns {Promise<MetaFact[]>}
   */
  async _extractFacts(summary, sessionId, client, model = "gpt-4o-mini") {
    const prompt = `从以下 session 摘要中提取**最多 5 条**结构化事实。

要求：
1. 每个事实应该是独立、可验证的陈述
2. 包含实体、属性、关系
3. 去除模糊和主观描述
4. 每个事实包含置信度 (0-1)
5. **严格控制在 5 条以内**——输出越短越好

摘要内容：
${summary}

输出格式（JSON object，包含 facts 数组）：
{
  "facts": [
    {
      "content": "事实内容",
      "tags": ["标签1", "标签2"],
      "confidence": 0.9
    }
  ]
}

只输出 JSON，不要其他解释。`;

    try {
      const response = await client.chat.completions.create({
        model: model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 8000,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content || "[]";
      // Some models (notably MiniMax) leak <think>...</think> reasoning blocks
      // into the response even when response_format=json_object is requested.
      // Strip the think block and the first JSON object afterwards before
      // parsing, so we don't fail with "Unexpected token '<'".
      const cleaned = stripThinkAndExtractJson(content);
      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        // Re-throw with the actual LLM output attached so we can debug
        // malformed responses (LLM may have returned a JSON array when we
        // asked for an object, or truncated the response at max_tokens).
        throw new Error(
          `Failed to parse LLM response as JSON: ${(parseErr as Error).message}\n` +
          `--- Cleaned content ---\n${cleaned}\n--- Raw content ---\n${content}`
        );
      }
      // Accept both shapes:
      //   - JSON object:  { "facts": [ ... ] }  (what response_format=json_object expects)
      //   - JSON array:   [ ... ]
      // Some models (MiniMax) return a bare array even when we asked for
      // an object, so we normalize here.
      const factsData: any[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.facts)
          ? parsed.facts
          : [];

      // 添加元数据
      const facts = factsData.map((f, idx) => ({
        id: `${sessionId}-${idx}`,
        content: f.content,
        tags: f.tags || [],
        sourceSession: sessionId,
        created_at: new Date().toISOString(),
        confidence: f.confidence || 0.5,
      }));

      return facts;
    } catch (err) {
      log.error(`Failed to extract facts from session ${sessionId}: ${err.message}`);
      return [];
    }
  }

  /**
   * 保存事实到文件
   * @param {MetaFact} fact
   */
  _saveFact(fact) {
    const fp = path.join(this.factsDir, `${fact.id}.json`);
    fs.writeFileSync(fp, JSON.stringify(fact, null, 2) + "\n", 'utf8');
  }

  // ══════════════════════════
  //  查询事实
  // ══════════════════════════

  /**
   * 搜索相关事实（简单关键词匹配，未来可接入向量搜索）
   * @param {string} query - 搜索关键词
   * @returns {MetaFact[]}
   */
  searchFacts(query) {
    const files = fs.readdirSync(this.factsDir).filter(f => f.endsWith(".json"));
    const results = [];

    for (const file of files) {
      try {
        const fact = JSON.parse(fs.readFileSync(path.join(this.factsDir, file), "utf-8"));

        // 简单匹配：content 或 tags 包含关键词
        const contentLower = fact.content.toLowerCase();
        const tagsLower = fact.tags.join(" ").toLowerCase();
        const queryLower = query.toLowerCase();

        if (contentLower.includes(queryLower) || tagsLower.includes(queryLower)) {
          results.push(fact);
        }
      } catch {
        // 跳过损坏的文件
      }
    }

    // 按置信度排序
    results.sort((a, b) => b.confidence - a.confidence);
    return results;
  }

  /**
   * 获取所有事实
   * @returns {MetaFact[]}
   */
  getAllFacts() {
    const files = fs.readdirSync(this.factsDir).filter(f => f.endsWith(".json"));
    const facts = [];

    for (const file of files) {
      try {
        const fact = JSON.parse(fs.readFileSync(path.join(this.factsDir, file), "utf-8"));
        facts.push(fact);
      } catch {
        // 跳过
      }
    }

    return facts;
  }
}

/**
 * 创建 DeepMemoryProcessor 实例（工厂函数）
 * 为了兼容 openhanako 的命名习惯
 */
export function createDeepMemoryProcessor() {
  return new DeepMemoryManager();
}

/**
 * Strip <think>...</think> blocks and any surrounding prose, then return
 * a JSON parseable string found in `text`.
 *
 * The strategy is:
 *   1. Remove all <think>...</think> blocks (greedy across newlines).
 *   2. Find the first '{' or '['.
 *   3. If the response is truncated mid-array (ends with '}' but no closing
 *      ']'), append the missing ']' so JSON.parse can still produce a
 *      useful array of facts.
 *   4. If the response is truncated mid-object (ends inside a '}' but the
 *      outer '}' or ']' is missing), append a closing '}' or ']'.
 *
 * This exists because reasoning models (e.g. MiniMax) emit a
 * <think>...</think> block before the actual structured output even when
 * `response_format: { type: "json_object" }` is set, and they can also
 * truncate the response at max_tokens mid-array. Without these guards
 * `JSON.parse` fails with `Unexpected token '<'` or
 * `Expected ',' or ']' after array element`.
 */
export function stripThinkAndExtractJson(text: string): string {
  let t = text
  // 1. Strip <think>...</think> blocks (handles non-greedy / nested cases).
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, "")
  // 2. Find the first JSON opener.
  const firstBrace = t.search(/[\[{]/)
  if (firstBrace === -1) return text
  // 3. Trim trailing prose after the JSON body.
  const opener = t[firstBrace]
  const closer = opener === "[" ? "]" : "}"
  const lastCloser = t.lastIndexOf(closer)
  if (lastCloser === -1) return text
  let body = t.slice(firstBrace, lastCloser + 1)
  // 4. Repair truncation: if body is an array that ends with '}' but no
  //    closing ']', or an object that ends with ',' inside a property,
  //    append the missing closer(s).
  if (opener === "[") {
    // Count opens/closes. If a '{' is unclosed inside the array, close it
    // first; then close the array.
    const opens = (body.match(/\{/g) || []).length
    const closes = (body.match(/\}/g) || []).length
    if (opens > closes) body += "}".repeat(opens - closes)
    if (!body.trimEnd().endsWith("]")) body += "]"
  } else {
    const opens = (body.match(/\{/g) || []).length
    const closes = (body.match(/\}/g) || []).length
    if (opens > closes) body += "}".repeat(opens - closes)
  }
  return body
}

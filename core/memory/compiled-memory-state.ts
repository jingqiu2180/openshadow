// @ts-nocheck
/**
 * compiled-memory-state.ts — 编译快照状态管理
 *
 * 职责：
 *   - 管理编译重置标记（reset.json）
 *   - 清除编译产物（memory.md, facts.md, today.md, week.md, longterm.md）
 *   - 清除摘要源文件
 *   - 规范化编译输出（去除 <think> 标签、解析数组格式）
 */

import fs from "fs";
import path from "path";
import { createModuleLogger } from "./debug-log.js";

const log = createModuleLogger("compiled-memory-state");

const COMPILED_FILES = ["memory.md", "facts.md", "today.md", "week.md", "longterm.md"];

// ══════════════════════
//  重置标记
// ══════════════════════

export function resetMarkerPath(memoryDir: string): string {
  return path.join(memoryDir, "reset.json");
}

/**
 * 读取上次重置时间
 * @param memoryDir - memory/ 目录的绝对路径
 * @returns {string|null} ISO 时间戳，或 null
 */
export function readCompiledResetAt(memoryDir: string): string | null {
  try {
    const raw = JSON.parse(fs.readFileSync(resetMarkerPath(memoryDir), "utf-8"));
    const value = raw?.compiledResetAt;
    if (!value || Number.isNaN(Date.parse(value))) return null;
    return value;
  } catch {
    return null;
  }
}

/**
 * 写入重置标记
 * @param memoryDir - memory/ 目录的绝对路径
 * @param resetAt - 重置时间（ISO 时间戳），默认当前时间
 * @returns {string} 写入的时间戳
 */
export function writeCompiledResetMarker(memoryDir: string, resetAt = new Date().toISOString()): string {
  if (!resetAt || Number.isNaN(Date.parse(resetAt))) {
    throw new Error("compiledResetAt must be an ISO timestamp");
  }
  fs.mkdirSync(memoryDir, { recursive: true });
  const marker = {
    compiledResetAt: resetAt,
    updatedAt: new Date().toISOString(),
  };
  atomicWriteSync(resetMarkerPath(memoryDir), JSON.stringify(marker, null, 2) + "\n");
  return resetAt;
}

// ══════════════════════
//  清除编译产物
// ══════════════════════

/**
 * 清除所有编译产物（memory.md, facts.md, today.md, week.md, longterm.md）
 * @param memoryDir - memory/ 目录的绝对路径
 */
export function clearCompiledMemoryArtifacts(memoryDir: string): void {
  fs.mkdirSync(memoryDir, { recursive: true });
  for (const name of COMPILED_FILES) {
    const filePath = path.join(memoryDir, name);
    fs.writeFileSync(filePath, "", "utf-8");
    removeIfExists(`${filePath}.fingerprint`);
  }
  log.info(`Cleared compiled memory artifacts in ${memoryDir}`);
}

/**
 * 清除摘要源文件（summaries/ 目录下的所有 .json 文件）
 * @param summariesDir - summaries/ 目录的绝对路径
 * @param summaryManager - 可选的 SessionSummaryManager 实例，用于清除缓存
 */
export function clearCompiledSummarySources(summariesDir: string, summaryManager: any = null): void {
  fs.mkdirSync(summariesDir, { recursive: true });
  for (const entry of fs.readdirSync(summariesDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    removeIfExists(path.join(summariesDir, entry.name));
  }
  summaryManager?.clearCache?.();
  log.info(`Cleared summary sources in ${summariesDir}`);
}

// ══════════════════════
//  规范化输出
// ══════════════════════

/**
 * 规范化编译段落正文（去除 <think> 标签、解析数组格式、去除标题行）
 * @param value - 原始文本
 * @returns {string} 规范化后的文本
 */
export function normalizeCompiledSectionBody(value: string): string {
  const raw = stripThinkTagBlocks(String(value || "")).trim();
  if (!raw) return "";

  // 如果是 JSON 数组格式，转换一下
  const parsedArray = parseStringArray(raw);
  const text = parsedArray
    ? parsedArray.map((item: string) => `- ${item.trim()}`).join("\n")
    : raw;

  return text
    .split(/\r?\n/)
    .filter((line: string) => !/^#{1,6}\s+\S/.test(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * 规范化 LLM 输出（调用 normalizeCompiledSectionBody，并检查未闭合的 <think> 标签）
 * @param value - LLM 原始输出
 * @param source - 来源标识（用于错误信息）
 * @returns {string} 规范化后的文本
 */
export function normalizeCompiledLLMResult(value: string, source = "compiled memory"): string {
  const normalized = normalizeCompiledSectionBody(value);
  if (!normalized && hasDanglingLeadingThinkTag(value)) {
    throw new Error(`${source} returned an unterminated thinking block`);
  }
  return normalized;
}

/**
 * 去除文本中的 <think>...</think> 标签块
 * @param value - 原始文本
 * @returns {string} 去除 <think> 标签后的文本
 */
export function stripThinkTagBlocks(value: string): string {
  return String(value || "")
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>\s*/gi, "")
    .replace(/^\s*<think(?:ing)?>[\s\S]*$/i, "")
    .replace(/<\/think(?:ing)?>\s*/gi, "");
}

/**
 * 检查文本是否以未闭合的 <think> 标签开头
 * @param value - 原始文本
 * @returns {boolean}
 */
export function hasDanglingLeadingThinkTag(value: string): boolean {
  const text = String(value || "");
  return /^\s*<think(?:ing)?>/i.test(text) && !/<\/think(?:ing)?>/i.test(text);
}

// ══════════════════════
//  辅助
// ══════════════════════

function parseStringArray(raw: string): string[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    if (!parsed.every((item: any) => typeof item === "string")) return null;
    return parsed.filter((item: string) => item.trim());
  } catch {
    return null;
  }
}

function removeIfExists(filePath: string): void {
  try {
    fs.unlinkSync(filePath);
  } catch (err: any) {
    if (err?.code !== "ENOENT") throw err;
  }
}

function atomicWriteSync(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, content, "utf-8");
  fs.renameSync(tmpPath, filePath);
}

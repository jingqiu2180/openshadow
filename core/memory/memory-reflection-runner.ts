// @ts-nocheck
/**
 * memory-reflection-runner.ts — 记忆反思运行器
 *
 * 职责：
 *   - 对 session snapshot 进行记忆反思
 *   - 生成滚动摘要（rolling summary）
 *   - 格式校验 + 有限次数修复
 *   - 与 SessionSummaryManager 对接
 */

import { createModuleLogger } from './debug-log';
import {
  MAX_ROLLING_SUMMARY_FORMAT_REPAIRS,
  buildRollingSummaryFormatRequirements,
  buildRollingSummaryRepairInput,
  buildRollingSummaryRepairPrompt,
  validateRollingSummaryFormat,
} from './rolling-summary-format';

const log = createModuleLogger("memory-reflection-runner");

// suffix 内容变更（补上输出格式契约）时 bump，便于在用量账本里区分模板代际
export const MEMORY_REFLECTION_TEMPLATE_VERSION = "memory-reflection.v2";
export const MEMORY_REFLECTION_REPAIR_TEMPLATE_VERSION = "memory-reflection-repair.v1";

/**
 * 构建记忆反思 suffix（LLM 消息）
 * @param {{ previousSummary?: string, timeZone?: string, locale?: string }} opts
 * @returns { role: "user", content: { type: "text", text: string }[] }
 */
export function buildMemoryReflectionSuffix(opts: {
  previousSummary?: string;
  timeZone?: string;
  locale?: string;
} = {}): { role: string; content: { type: string; text: string }[] } {
  const { previousSummary = "", timeZone = "UTC", locale = "zh-CN" } = opts;
  return {
    role: "user",
    content: [{
      type: "text",
      text: [
        "Internal memory reflection task.",
        "Read the session prefix above and produce an updated rolling memory summary.",
        "Do not call tools.",
        "Do not address the user.",
        `Time zone: ${timeZone}`,
        previousSummary ? `<previous-summary>\n${previousSummary}\n</previous-summary>` : "<previous-summary>\n\n</previous-summary>",
        buildRollingSummaryFormatRequirements(locale),
        "Return only the summary text.",
      ].join("\n\n"),
    }],
  };
}

/**
 * 构建记忆反思修复 suffix（格式修复）
 * @param {{ issues?: string[], summaryText?: string, locale?: string }} opts
 * @returns { role: "user", content: { type: "text", text: string }[] }
 */
export function buildMemoryReflectionRepairSuffix(opts: {
  issues?: string[];
  summaryText?: string;
  locale?: string;
} = {}): { role: string; content: { type: "text", text: string }[] } {
  const { issues = [], summaryText = "", locale = "zh-CN" } = opts;
  return {
    role: "user",
    content: [{
      type: "text",
      text: [
        "Internal memory reflection format repair task.",
        "Do not call tools.",
        "Do not address the user.",
        buildRollingSummaryRepairPrompt(locale),
        buildRollingSummaryRepairInput({ locale, issues, summaryText }),
      ].join("\n\n"),
    }],
  };
}

/**
 * 格式修复子任务的独立 usageContext（#1628 审查 issue 2）：
 * 修复用量必须与初次 reflection 分账，operation 在调用方给定的初次
 * operation 上追加 `_repair` 后缀。
 */
function buildRepairUsageContext(usageContext: any): any {
  const operation = typeof usageContext?.source?.operation === "string"
    ? usageContext.source.operation.trim()
    : "";
  if (!operation) return usageContext;
  return {
    ...usageContext,
    source: { ...usageContext.source, operation: `${operation}_repair` },
  };
}

/**
 * 运行记忆反思
 * @param {{
 *   snapshot: string,
 *   model: any,
 *   cacheKeyParams: any,
 *   previousSummary?: string,
 *   sessionId?: string,
 *   messages?: any[],
 *   sourceTimeRange?: any,
 *   timeZone?: string,
 *   streamFn?: Function,
 *   options?: Record<string, any>,
 *   usageLedger?: any,
 *   usageContext?: any,
 * }} opts
 * @returns {Promise<{ summary: string, changed: boolean, data: any }>}
 */
export async function runMemoryReflection(opts: {
  snapshot: string;
  model: any;
  cacheKeyParams?: any;
  previousSummary?: string;
  sessionId?: string;
  messages?: any[];
  sourceTimeRange?: any;
  timeZone?: string;
  streamFn?: (text: string) => void;
  options?: Record<string, any>;
  usageLedger?: any;
  usageContext?: any;
} = {}): Promise<{ summary: string; changed: boolean; data: any }> {
  const {
    snapshot,
    model,
    cacheKeyParams,
    previousSummary = "",
    sessionId,
    messages = [],
    sourceTimeRange = null,
    timeZone = "UTC",
    streamFn,
    options = {},
    usageLedger,
    usageContext,
  } = opts;

  const locale = getLocale();

  // 第一次调用：生成滚动摘要
  const runSideTask = (suffixMessage: any, templateVersion: string, taskUsageContext: any) => {
    // 简化版：直接调用 LLM
    // 实际实现需要调用 core/llm-client.ts 的 callText
    // 这里先写接口，后续接入真实 LLM 调用
    throw new Error("runMemoryReflection: LLM call not implemented yet");
  };

  let activeTask: any;
  let piiDetected = false;

  // 第一次生成
  activeTask = await runSideTask(
    buildMemoryReflectionSuffix({ previousSummary, timeZone, locale }),
    MEMORY_REFLECTION_TEMPLATE_VERSION,
    usageContext,
  );

  let summary = activeTask.text?.trim() || "";

  // 写入前结构校验 + 有限次数修复
  const repairUsageContext = buildRepairUsageContext(usageContext);
  let repairsUsed = 0;
  let validation = summary ? validateRollingSummaryFormat(summary, locale) : { valid: true, issues: [] };

  while (!validation.valid && repairsUsed < MAX_ROLLING_SUMMARY_FORMAT_REPAIRS) {
    repairsUsed += 1;
    log.warn(`Memory reflection format invalid, repair attempt ${repairsUsed}: ${validation.issues.join("; ")}`);

    activeTask = await runSideTask(
      buildMemoryReflectionRepairSuffix({ issues: validation.issues, summaryText: summary, locale }),
      MEMORY_REFLECTION_REPAIR_TEMPLATE_VERSION,
      repairUsageContext,
    );

    summary = activeTask.text?.trim() || "";
    if (!summary) {
      validation = { valid: false, issues: [...validation.issues, "format repair attempt returned empty output"] };
      break;
    }
    validation = validateRollingSummaryFormat(summary, locale);
  }

  if (!validation.valid) {
    const err: any = new Error(
      `memory reflection summary violates the rolling summary format after ${repairsUsed} repair attempt(s): ${validation.issues.join("; ")}`
    );
    err.cacheMetadata = activeTask.metadata;
    throw err;
  }

  const now = new Date().toISOString();
  return {
    summary,
    changed: summary.length > 0,
    data: {
      session_id: sessionId,
      summary,
      snapshot: summary, // 暂时用 summary 代替 snapshot
      snapshot_at: now,
      updated_at: now,
    },
  };
}

/**
 * 获取当前 locale（简化版）
 * @returns {string}
 */
function getLocale(): string {
  // TODO: 接入实际的 locale 检测
  return "zh-CN";
}

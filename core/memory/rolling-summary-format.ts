// @ts-nocheck
/**
 * rolling-summary-format.ts — rolling summary ⇄ compileFacts 的格式契约单一源头
 *
 * 契约内容：
 *   - 摘要必须包含 重要事实 / Key Facts 与 事情经过 / Timeline 两个标题段，
 *     facts 段必须能被 compileFacts 的标题段提取规则切出来；
 *   - prompt 端的输出格式要求（buildRollingSummaryFormatRequirements）、
 *     写入前结构校验（validateRollingSummaryFormat）、格式修复指令
 *     （buildRollingSummaryRepairPrompt / buildRollingSummaryRepairInput）、
 *     facts 段提取规则（extractFactSection / isEmptyFactSection）全部住在这里。
 *
 * 使用方：
 *   - core/memory/session-summary.ts（legacy utility 产出路径）
 *   - lib/memory/memory-reflection-runner.ts（cache snapshot reflection 产出路径）
 *   - lib/memory/memory-ticker.ts（write 模式落盘前的最终守门）
 *   - lib/memory/compile.ts（compileFacts 消费侧提取）
 *   - lib/memory/prompts/rolling-summary.ts（prompt 模板）
 *
 * 禁止任何调用方再各自维护一份标题名、提取规则或输出格式文案。
 */

// ══════════════════════════
//  标题常量（单一来源）
// ══════════════════════════

/** compileFacts 提取 facts 段时接受的标题（任意 1-6 级，大小写不敏感）。约定 [0] 中文、[1] 英文 */
export const FACT_SECTION_TITLES = ["重要事实", "Key Facts"];

/** 事情经过段标题，用于界定 facts 段结束位置。约定 [0] 中文、[1] 英文 */
export const TIMELINE_SECTION_TITLES = ["事情经过", "Timeline"];

// ══════════════════════════
//  标题读写辅助
// ══════════════════════════

/**
 * prompt 文案中按 locale 引用 facts 段标题文本的单一来源。
 * 调用方禁止再硬编码标题字面量（标题改名时字面量会漂移，#1628 审查）。
 * @param {string} locale
 * @returns {string}
 */
export function getFactSectionTitle(locale = "zh-CN"): string {
  return isZhLocale(locale) ? FACT_SECTION_TITLES[0] : FACT_SECTION_TITLES[1];
}

/**
 * prompt 文案中按 locale 引用 timeline 段标题文本的单一来源。
 * @param {string} locale
 * @returns {string}
 */
export function getTimelineSectionTitle(locale = "zh-CN"): string {
  return isZhLocale(locale) ? TIMELINE_SECTION_TITLES[0] : TIMELINE_SECTION_TITLES[1];
}

function isZhLocale(locale: string): boolean {
  return String(locale || "").startsWith("zh");
}

// ══════════════════════════
//  输出格式要求 prompt 块
// ══════════════════════════

/**
 * 输出格式要求 prompt 块。两条产出路径（legacy utility 与
 * memory reflection suffix）以及 prompts/rolling-summary.ts 模板共用。
 * @param {string} locale
 * @returns {string}
 */
export function buildRollingSummaryFormatRequirements(locale = "zh-CN"): string {
  if (!isZhLocale(locale)) {
    return `## Output Format
The final answer must contain exactly two third-level headings, with fixed text and order:
1. The first line must be \`### Key Facts\`
2. The second heading must be \`### Timeline\`

The body under both headings must use unordered lists. Each list item must start with \`- \`.
If a section has no content, output one list item: \`- None\`.
Do not output any preamble, conclusion, XML tags, or code fences outside those headings.`;
  }

  return `## 输出格式
最终答案必须只包含两个三级标题，标题文本和顺序固定：
1. 第一行必须是 \`### 重要事实\`
2. 第二个标题必须是 \`### 事情经过\`

两个标题下的正文都必须使用无序列表。列表项必须以 \`- \` 开头。
如果某一节没有内容，也要输出一个列表项：\`- 无\`。
标题之外不要输出前言、后记、XML 标签或代码块。`;
}

// ══════════════════════════
//  格式修复
// ══════════════════════════

/** 写入前结构校验失败后允许的 LLM 格式修复次数上限（初次生成之外的额外调用数）。 */
export const MAX_ROLLING_SUMMARY_FORMAT_REPAIRS = 1;

/**
 * 格式修复调用的稳定 system 指令（utility 路径放 systemPrompt，
 * reflection 路径拼进修复 suffix）。
 * @param {string} locale
 * @returns {string}
 */
export function buildRollingSummaryRepairPrompt(locale = "zh-CN"): string {
  const requirements = buildRollingSummaryFormatRequirements(locale);
  if (!isZhLocale(locale)) {
    return `You are the format repairer for the memory system's rolling summaries. The previous summary draft violates the required fixed structure and cannot be parsed by the memory system. Rearrange the information in the given draft into the required structure: do not add, remove, or rewrite any factual content, do not explain, and output only the full repaired summary.

${requirements}`;
  }

  return `你是记忆系统滚动摘要的格式修复器。上一步生成的摘要草稿不符合要求的固定结构，记忆系统无法解析。请把给定草稿中的信息原样重排进规定结构：不要新增、删除或改写事实内容，不要解释，直接输出修复后的摘要全文。

${requirements}`;
}

/**
 * 格式修复调用的动态输入：校验失败原因 + 待修复草稿。
 * @param {{ locale?: string, issues?: string[], summaryText?: string }} opts
 * @returns {string}
 */
export function buildRollingSummaryRepairInput({ locale = "zh-CN", issues = [], summaryText = "" } = {}): string {
  const isZh = isZhLocale(locale);
  const issuesLabel = isZh ? "## 校验失败原因" : "## Validation Failures";
  const draftLabel = isZh ? "## 待修复草稿" : "## Draft To Repair";
  const issueLines = (Array.isArray(issues) ? issues : [])
    .map((issue: string) => `- ${String(issue || "").trim()}`)
    .filter((line: string) => line !== "- ")
    .join("\n");

  return `${issuesLabel}

${issueLines || (isZh ? "- 未知" : "- unknown")}

${draftLabel}

<draft-summary>
${String(summaryText || "")}
</draft-summary>`;
}

// ══════════════════════════
//  校验
// ══════════════════════════

/**
 * 校验滚动摘要格式。
 * 宽松校验：只拦截会破坏 compileFacts 提取假设的结构
 * （标题缺失、facts 段空体、facts 段无法收尾）。
 * @param {string} text - 摘要文本
 * @param {string} locale
 * @returns {{ valid: boolean, issues: string[] }}
 */
export function validateRollingSummaryFormat(text: string, locale = "zh-CN"): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const factTitle = getFactSectionTitle(locale);
  const timelineTitle = getTimelineSectionTitle(locale);

  // 1. 检查是否包含 facts 段标题
  if (!hasFactSectionHeading(text)) {
    issues.push(`Missing section heading: ${factTitle}`);
  }

  // 2. 检查 facts 段是否为空
  const factSection = extractFactSection(text);
  if (factSection && isEmptyFactSection(factSection)) {
    issues.push(`Fact section is present but empty: ${factTitle}`);
  }

  // 3. 检查 facts 段是否能正确收尾（即有 timeline 段或文档结束）
  if (factSection && !text.includes(timelineTitle)) {
    issues.push(`Fact section cannot be terminated: missing heading ${timelineTitle}`);
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

// ══════════════════════════
//  提取辅助
// ══════════════════════════

/**
 * 解析 markdown 标题行（1-6 级）。
 * @param {string} line
 * @returns {{ level: number, title: string } | null}
 */
export function parseMarkdownHeading(line: string): { level: number; title: string } | null {
  const match = /^(#{1,6})[ \t]+(.+?)[ \t]*$/.exec(String(line || ""));
  if (!match) return null;
  return {
    level: match[1].length,
    title: match[2].replace(/[ \t]+#+[ \t]*$/, "").trim(),
  };
}

function normalizeHeadingTitle(title: string): string {
  return String(title || "").trim().toLowerCase();
}

/**
 * 检查摘要文本是否包含 facts 段标题（任意 1-6 级）。
 * @param {string} text
 * @returns {boolean}
 */
export function hasFactSectionHeading(text: string): boolean {
  const lines = String(text || "").split(/\r?\n/);
  for (const line of lines) {
    const parsed = parseMarkdownHeading(line);
    if (!parsed) continue;
    const normalizedTitle = normalizeHeadingTitle(parsed.title);
    if (FACT_SECTION_TITLES.some(t => normalizeHeadingTitle(t) === normalizedTitle)) {
      return true;
    }
  }
  return false;
}

/**
 * 从摘要文本中提取 facts 段（### 重要事实 到 ### 事情经过 之间的内容）。
 * @param {string} text
 * @returns {string|null}
 */
export function extractFactSection(text: string): string | null {
  const factTitle = getFactSectionTitle();
  const timelineTitle = getTimelineSectionTitle();

  const lines = String(text || "").split(/\r?\n/);
  let inFactSection = false;
  const factLines: string[] = [];

  for (const line of lines) {
    const parsed = parseMarkdownHeading(line);
    if (parsed) {
      const normalizedTitle = normalizeHeadingTitle(parsed.title);
      // 遇见 facts 段标题，开始收集
      if (FACT_SECTION_TITLES.some(t => normalizeHeadingTitle(t) === normalizedTitle)) {
        inFactSection = true;
        continue;
      }
      // 遇见 timeline 段标题，停止收集
      if (TIMELINE_SECTION_TITLES.some(t => normalizeHeadingTitle(t) === normalizedTitle)) {
        break;
      }
    }
    if (inFactSection) {
      factLines.push(line);
    }
  }

  if (factLines.length === 0) return null;
  return factLines.join("\n").trim();
}

/**
 * 检查 facts 段是否为空（只有 "- 无" 或空行）。
 * @param {string} factSectionText
 * @returns {boolean}
 */
export function isEmptyFactSection(factSectionText: string): boolean {
  const trimmed = String(factSectionText || "").trim();
  if (!trimmed) return true;
  // 只有 "- 无" 或 "- None"
  const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(l => l);
  if (lines.length === 0) return true;
  if (lines.length === 1 && /^-\s*(无|None)$/.test(lines[0])) return true;
  return false;
}

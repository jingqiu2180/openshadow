// @ts-nocheck
/**
 * pi-sdk 兼容层 — 让 openhanako 工具代码能直接在 openshadow 里用
 *
 * openhanako 的 lib/pi-sdk/index.ts 是 @mariozechner/pi-coding-agent 的适配层。
 * openshadow 不需要那个 SDK，只需要提供工具代码里用到的导出占位符。
 */

// ── Type — 直接 re-export typebox ────────────────────────
import { Type } from 'typebox'
import path from 'path'
import fs from 'fs'
import https from 'https'
import { execSync } from 'child_process'
export { Type }

// ── MiniMax API 配置（从 server/index.ts 注入）─────────────
export let minimaxApiKey: string | null = null
export let minimaxBaseUrl: string = 'https://token-plan-cn.xiaomimimo.com/v1'
export let minimaxModel: string = 'MiniMax-M3'

export function setMiniMaxConfig(key: string, baseUrl?: string, model?: string) {
  minimaxApiKey = key
  if (baseUrl) minimaxBaseUrl = baseUrl
  if (model) minimaxModel = model
}

// ── StringEnum — 生成枚举型 JSON Schema ──────────────────
export function StringEnum(values: string[], opts: { description?: string; fallback?: string } = {}) {
  const schema: any = {
    type: 'string',
    enum: [...values],
  }
  if (opts.description) schema.description = opts.description
  if (opts.fallback) schema.default = opts.fallback
  return schema
}

// ── 占位导出（工具代码里 import 了但 openshadow 不需要实际实现）─────
// ── 工具 ───────────────────────────────────────
const TOOLS: any[] = [
  { type: "function", function: { name: "bash", description: "Execute a shell command. Returns stdout/stderr.", parameters: { type: "object", properties: { command: { type: "string", description: "The shell command to execute" } }, required: ["command"] } } },
  { type: "function", function: { name: "read", description: "Read a file's contents", parameters: { type: "object", properties: { path: { type: "string", description: "Absolute or relative file path" } }, required: ["path"] } } },
  { type: "function", function: { name: "write", description: "Create or overwrite a file", parameters: { type: "object", properties: { path: { type: "string", description: "File path" }, content: { type: "string", description: "File content" } }, required: ["path", "content"] } } },
  { type: "function", function: { name: "grep", description: "Search for text pattern in files", parameters: { type: "object", properties: { pattern: { type: "string", description: "Regex pattern to search for" }, path: { type: "string", description: "Directory or file path (optional, defaults to cwd)" } }, required: ["pattern"] } } },
  { type: "function", function: { name: "ls", description: "List directory contents", parameters: { type: "object", properties: { path: { type: "string", description: "Directory path" } }, required: ["path"] } } },
  { type: "function", function: { name: "edit", description: "Edit a file by replacing old text with new text", parameters: { type: "object", properties: { path: { type: "string", description: "File path" }, old: { type: "string", description: "Text to find" }, "new": { type: "string", description: "Replacement text" } }, required: ["path", "old", "new"] } } },
];

function executeTool(name: string, args: any): string {
  try {
    switch (name) {
      case "bash": return String(execSync(args.command, { encoding: "utf8", timeout: 30000, maxBuffer: 1024 * 1024 }));
      case "read": { const content = fs.readFileSync(args.path, "utf8"); return content.length > 50000 ? content.slice(0, 50000) + "\n...(truncated)" : content; }
      case "write": { fs.writeFileSync(args.path, args.content, "utf8"); return "文件已写入: " + args.path; }
      case "grep": { const p = args.pattern.replace(/"/g, '\\"'); return String(execSync('grep -rn "' + p + '" ' + (args.path || '.'), { encoding: "utf8", timeout: 10000 })).slice(0, 20000); }
      case "ls": return fs.readdirSync(args.path, { withFileTypes: true }).map((e: any) => (e.isDirectory() ? "[dir]  " : "       ") + e.name).join("\n");
      case "edit": { let c2 = fs.readFileSync(args.path, "utf8"); c2 = c2.replace(args.old, args["new"]); fs.writeFileSync(args.path, c2, "utf8"); return "编辑完成: " + args.path; }
      default: return "未知工具: " + name;
    }
  } catch (e: any) { return "Error: " + (e.message || String(e)); }
}

export async function createAgentSession(_opts: any): Promise<{ session: any; modelFallbackMessage?: string }> {
  const noop = () => {}
  const sessionManager = _opts?.sessionManager || {}
  const model = _opts?.model || null

  // ── 真实事件发射器 ──
  const listeners: Set<(event: any) => void> = new Set()
  function emit(event: any) {
    for (const fn of listeners) fn(event)
  }
  function subscribe(handler: any) {
    listeners.add(handler)
    return () => { listeners.delete(handler) }
  }

  // ── MiniMax API 调用 ──
  let systemPrompt = ""; try { const p = path.join(process.cwd(), "yuan", "hanako.md"); if (fs.existsSync(p)) systemPrompt = fs.readFileSync(p, "utf-8"); } catch {} const sessionMessages: any[] = [];
  if (systemPrompt) sessionMessages.push({ role: "system", content: systemPrompt });

  async function callMiniMaxAPI(text: string): Promise<string> {
    const apiKey = minimaxApiKey;
    if (!apiKey) throw new Error('MiniMax API key not configured');

    // 构建消息历史
    const messages: any[] = [];
    if (systemPrompt) sessionMessages.push({ role: 'system', content: systemPrompt });
    sessionMessages.push({ role: 'user', content: text });

    // 工具调用循环（最多 5 轮）
    for (let round = 0; round < 5; round++) {
      const body = JSON.stringify({
        model: minimaxModel,
        messages: sessionMessages,
        tools: TOOLS,
        tool_choice: 'auto',
        stream: true,
        max_tokens: 4096,
      });

      const streamResult: { text: string; toolCalls: any[]; finishReason: string } = await new Promise((resolve, reject) => {
        const url = new URL(minimaxBaseUrl + '/chat/completions');
        const req = https.request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        }, (res) => {
          let fullText = '';
          const toolCalls: Record<number, any> = {};
          let finishReason = '';
          res.on('data', (chunk: Buffer) => {
            const lines = chunk.toString().split('\n').filter((l: string) => l.startsWith('data: '));
            for (const line of lines) {
              const json = line.slice(6);
              if (json === '[DONE]') { resolve({ text: fullText, toolCalls: Object.values(toolCalls), finishReason }); return; }
              try {
                const parsed = JSON.parse(json);
                const delta = parsed.choices?.[0]?.delta;
                if (!delta) continue;
                if (delta.content) {
                  fullText += delta.content;
                  emit({ type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: delta.content } });
                }
                if (delta.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    const idx = tc.index;
                    if (!toolCalls[idx]) toolCalls[idx] = { id: '', function: { name: '', arguments: '' } };
                    if (tc.id) toolCalls[idx].id = tc.id;
                    if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
                    if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
                  }
                }
                if (parsed.choices?.[0]?.finish_reason) finishReason = parsed.choices[0].finish_reason;
              } catch {}
            }
          });
          res.on('end', () => resolve({ text: fullText, toolCalls: Object.values(toolCalls), finishReason }));
          res.on('error', reject);
        });
        req.on('error', reject);
        req.write(body);
        req.end();
      });

      // 无工具调用 → 返回文本
      if (streamResult.toolCalls.length === 0) {
        return streamResult.text || '(no response)';
      }

      // 添加 assistant 消息（含 tool_calls）
      const assistantMsg: any = { role: 'assistant', content: streamResult.text || null };
      assistantMsg.tool_calls = streamResult.toolCalls.map((tc: any) => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.function.name, arguments: tc.function.arguments },
      }));
      sessionMessages.push(assistantMsg);

      // 执行工具
      for (const tc of streamResult.toolCalls) {
        let args: any = {};
        try { args = JSON.parse(tc.function.arguments); } catch {}
        const toolName = tc.function.name;
        emit({ type: 'tool_start', name: toolName, args });
        const result = executeTool(toolName, args);
        emit({ type: 'tool_end', name: toolName, result });
        sessionMessages.push({ role: 'tool', tool_call_id: tc.id, content: result });
      }
    }

    return '已执行工具调用。';
  }
return {
    session: {
      subscribe,
      addEventListener: subscribe,
      dispatchEvent: (e: any) => { emit(e); return true },
      async reload() {},
      async prompt(promptText: string, _opts2?: any) {
        try {
          const result = await callMiniMaxAPI(promptText)
          return { text: result, toolMedia: [] }
        } catch (err: any) {
          emit({ type: 'error', message: err.message })
          return { text: `[Error: ${err.message}]`, toolMedia: [] }
        }
      },
      isStreaming: false,
      isCompacting: false,
      model,
      thinkingLevel: 'off',
      sessionManager,
      setThinkingLevel: noop,
      setActiveToolsByName: noop,
      settingsManager: _opts?.settingsManager || { getCompactionSettings: () => null },
      agent: { state: {} },
    },
  }
}

// Re-export real SessionManager from @mariozechner/pi-coding-agent
export { SessionManager } from '@mariozechner/pi-coding-agent'

export const SettingsManager = {
  inMemory(): any {
    return {
      getAll: () => ({}),
      get: (_key: string) => undefined,
      set: (_key: string, _val: any) => {},
    }
  },
}

export const PI_BUILTIN_TOOL_NAMES = ['read', 'write', 'edit', 'bash', 'grep', 'find', 'ls']
export const getPiModel = undefined as any
export const completeSimple = undefined as any
export const convertAgentMessagesToLlm = undefined as any
export const prepareCompaction = undefined as any
export const formatSkillsForPrompt = undefined as any
export const getLastAssistantUsage = undefined as any

export const AuthStorage = {
  create(filePath: string): any {
    return {
      filePath,
      _data: {} as Record<string, any>,
      load() { return this._data },
      save() { /* noop */ },
      get(provider: string) { return this._data[provider] },
      set(provider: string, data: any) { this._data[provider] = data },
    }
  }
}

export const estimateTokens = undefined as any
export const findCutPoint = undefined as any
export const serializeConversation = undefined as any
export const shouldCompact = undefined as any
export const parseSessionEntries = undefined as any
export const buildSessionContext = undefined as any
export const generateSummary = undefined as any
export const registerOAuthProvider = undefined as any

// ── DefaultResourceLoader ────────────────────────────────
export class DefaultResourceLoader {
  options: any = {}
  getSystemPrompt: () => any = () => null
  getSkills: () => any = () => ({ skills: [] })

  constructor(opts: any) {
    this.options = opts
  }

  async reload(): Promise<void> {}
}

// ── SkillManager 占位 ────────────────────────────────────
export class SkillManager {
  allSkills: any[] = []
  init(resourceLoader: any, agents: any, hiddenSkills: Set<string>): void {
    // minimal placeholder — noop
  }
}

// ── 占位函数导出 ────────────────────────────────────────
export function createModelRegistry(authStorage: any, filePath: string): any {
  return {
    getAvailable(): any[] { return [] },
    getModel(ref: any): any { return null },
    getAll(): any[] { return [] },
    async refresh(): Promise<void> {},
  }
}

export function emitSessionShutdown(...args: any[]): any {
  return undefined
}

export function refreshSessionModelFromRegistry(...args: any[]): any {
  return undefined
}

// ── 工具创建函数占位 ──────────────────────────────────
function makeTool(name: string, desc: string): any {
  return {
    name,
    description: desc,
    parameters: { type: 'object', properties: {} },
    execute: async () => ({ content: [{ type: 'text', text: `[placeholder] ${name}` }] }),
  }
}
export function createReadTool(...args: any[]): any { return makeTool('read', 'Read a file') }
export function createWriteTool(...args: any[]): any { return makeTool('write', 'Write a file') }
export function createEditTool(...args: any[]): any { return makeTool('edit', 'Edit a file') }
export function createBashTool(...args: any[]): any { return makeTool('bash', 'Run a shell command') }
export function createGrepTool(...args: any[]): any { return makeTool('grep', 'Search file contents') }
export function createFindTool(...args: any[]): any { return makeTool('find', 'Find files by name') }
export function createLsTool(...args: any[]): any { return makeTool('ls', 'List directory contents') }

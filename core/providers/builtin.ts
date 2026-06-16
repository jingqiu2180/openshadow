/**
 * Built-in provider catalog (Stage 1a).
 *
 * The wizard uses this to populate the "AI Provider" dropdown.
 * Each entry is a *static spec*; the user still needs to supply their own API key.
 *
 * Adding a new provider here is the only place to touch — no other code changes needed.
 */
import type { BuiltinProviderSpec } from './types.js'

export const BUILTIN_PROVIDERS: Record<string, BuiltinProviderSpec> = {
  openai: {
    type: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    requiresApiKey: true,
    notes: '官方 OpenAI API',
  },
  minimax: {
    type: 'openai',
    label: 'MiniMax (abab)',
    baseUrl: 'https://api.minimax.chat/v1',
    models: ['abab6.5s-chat', 'abab6.5s', 'MiniMax-Text-01'],
    requiresApiKey: true,
    notes: 'MiniMax 大模型,OpenAI 协议兼容',
  },
  dashscope: {
    type: 'openai',
    label: '阿里云百炼 (DashScope)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-long'],
    requiresApiKey: true,
    notes: '阿里云百炼,OpenAI 协议兼容',
  },
  deepseek: {
    type: 'openai',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    requiresApiKey: true,
    notes: '深度求索,性价比高',
  },
  gemini: {
    type: 'gemini',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    requiresApiKey: true,
    notes: 'Google Gemini (原生 API,非 OpenAI 协议)',
  },
  ollama: {
    type: 'ollama',
    label: 'Ollama (本地)',
    baseUrl: 'http://localhost:11434/v1',
    models: [], // Ollama models are dynamic; user adds locally via `ollama pull`
    requiresApiKey: false,
    notes: '本地 Ollama 服务,无需 API key',
  },
}

export const BUILTIN_PROVIDER_IDS = Object.keys(BUILTIN_PROVIDERS)

/**
 * Create a Provider object from a built-in spec by id.
 * The user supplies apiKey and isDefault; the rest is filled in from the catalog.
 */
export function providerFromBuiltin(
  builtinId: string,
  apiKey: string,
  options: { id?: string; isDefault?: boolean; model?: string } = {},
) {
  const spec = BUILTIN_PROVIDERS[builtinId]
  if (!spec) throw new Error(`Unknown built-in provider: ${builtinId}`)
  return {
    id: options.id ?? builtinId,
    type: spec.type,
    apiKey: apiKey || 'ollama-no-key-needed',
    baseUrl: spec.baseUrl,
    models: spec.models.length > 0 ? spec.models : (options.model ? [options.model] : []),
    isDefault: options.isDefault ?? false,
  }
}

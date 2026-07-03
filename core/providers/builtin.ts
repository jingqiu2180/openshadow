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
    models: [],
    requiresApiKey: false,
    notes: '本地 Ollama 服务,无需 API key',
  },
  anthropic: {
    type: 'anthropic',
    label: 'Anthropic (Claude)',
    baseUrl: 'https://api.anthropic.com',
    models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
    requiresApiKey: true,
    notes: 'Anthropic Messages API,非 OpenAI 协议',
  },
  zhipu: {
    type: 'openai',
    label: '智谱 AI (GLM)',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-5.2', 'glm-5.1', 'glm-5', 'glm-5-turbo', 'glm-4-plus', 'glm-4-flash'],
    requiresApiKey: true,
    notes: '智谱 GLM 系列大模型,OpenAI 协议兼容',
  },
  moonshot: {
    type: 'openai',
    label: 'Moonshot (Kimi)',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['kimi-k2.6', 'kimi-k2.5', 'kimi-k2', 'moonshot-v1-128k', 'moonshot-v1-32k', 'moonshot-v1-8k'],
    requiresApiKey: true,
    notes: '月之暗面 Kimi 大模型,OpenAI 协议兼容',
  },
  siliconflow: {
    type: 'openai',
    label: 'SiliconFlow (硅基流动)',
    baseUrl: 'https://api.siliconflow.cn/v1',
    models: ['deepseek-v3.2', 'deepseek-chat', 'deepseek-reasoner', 'qwen3-max', 'qwen3-plus', 'qwen3-mini'],
    requiresApiKey: true,
    notes: '硅基流动聚合平台,支持 70+ 开源模型',
  },
  volcengine: {
    type: 'openai',
    label: '火山引擎 (豆包)',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: ['doubao-seed-2-0-pro-260215', 'doubao-seed-2-0-mini-260215', 'doubao-seed-1-6-flash-250828', 'doubao-pro-256k', 'doubao-pro-128k', 'doubao-lite-128k'],
    requiresApiKey: true,
    notes: '火山引擎豆包大模型,OpenAI 协议兼容',
  },
  mistral: {
    type: 'openai',
    label: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'pixtral-large-latest'],
    requiresApiKey: true,
    notes: 'Mistral AI,OpenAI 协议兼容',
  },
  groq: {
    type: 'openai',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'meta-llama/llama-4-maverick-17b-128e-instruct', 'meta-llama/llama-4-scout-17b-16e-instruct'],
    requiresApiKey: true,
    notes: 'Groq 超低延迟推理,OpenAI 协议兼容',
  },
  openrouter: {
    type: 'openai',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: ['anthropic/claude-sonnet-4.6', 'anthropic/claude-opus-4.5', 'anthropic/claude-sonnet-4', 'google/gemini-2.5-pro', 'openai/gpt-4o'],
    requiresApiKey: true,
    notes: 'OpenRouter 聚合路由,支持 400+ 模型',
  },
  perplexity: {
    type: 'openai',
    label: 'Perplexity',
    baseUrl: 'https://api.perplexity.ai',
    models: ['llama-3.1-70b-instruct', 'llama-3.1-8b-instruct', 'mixtral-8x7b-instruct'],
    requiresApiKey: true,
    notes: 'Perplexity 搜索增强 LLM,OpenAI 协议兼容',
  },
  together: {
    type: 'openai',
    label: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    models: ['Qwen/Qwen3-235B-A22B-Instruct-2507-tput', 'Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8', 'deepseek-ai/DeepSeek-R1', 'deepseek-ai/DeepSeek-V3'],
    requiresApiKey: true,
    notes: 'Together AI 开源模型推理,OpenAI 协议兼容',
  },
  fireworks: {
    type: 'openai',
    label: 'Fireworks AI',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    models: ['deepseek-v3p2', 'deepseek-r1', 'deepseek-v3', 'llama-v3p1-405b-instruct'],
    requiresApiKey: true,
    notes: 'Fireworks AI 推理平台,OpenAI 协议兼容',
  },
  infini: {
    type: 'openai',
    label: '无问芯穹 (Infini)',
    baseUrl: 'https://cloud.infini-ai.com/maas/v1',
    models: ['deepseek-v3.2', 'deepseek-chat', 'deepseek-reasoner', 'qwen3-max', 'qwen3-plus'],
    requiresApiKey: true,
    notes: '无问芯穹大模型平台,OpenAI 协议兼容',
  },
  stepfun: {
    type: 'openai',
    label: '阶跃星辰 (StepFun)',
    baseUrl: 'https://api.stepfun.com/v1',
    models: ['step-3.5-flash', 'step-3', 'step-2-16k', 'step-2-mini', 'step-1v-32k', 'step-1v-8k'],
    requiresApiKey: true,
    notes: '阶跃星辰大模型,OpenAI 协议兼容',
  },
  hunyuan: {
    type: 'openai',
    label: '腾讯混元',
    baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
    models: ['hunyuan-t1-latest', 'hunyuan-turbos-latest', 'hunyuan-turbo-latest', 'hunyuan-pro-latest', 'hunyuan-vision-latest'],
    requiresApiKey: true,
    notes: '腾讯混元大模型,OpenAI 协议兼容',
  },
  baichuan: {
    type: 'openai',
    label: '百川智能',
    baseUrl: 'https://api.baichuan-ai.com/v1',
    models: ['Baichuan4-Air', 'Baichuan4-Turbo', 'Baichuan3-Turbo'],
    requiresApiKey: true,
    notes: '百川智能大模型,OpenAI 协议兼容',
  },
  'baidu-cloud': {
    type: 'openai',
    label: '百度智能云 (文心)',
    baseUrl: 'https://qianfan.baidubce.com/v2',
    models: ['ernie-4.5-128k', 'ernie-4.5-8k', 'ernie-4.0-8k', 'ernie-4.0-turbo-8k', 'ernie-speed-8k', 'ernie-lite-8k'],
    requiresApiKey: true,
    notes: '百度文心大模型,OpenAI 协议兼容',
  },
  modelscope: {
    type: 'openai',
    label: '魔搭 (ModelScope)',
    baseUrl: 'https://api-inference.modelscope.cn/v1',
    models: ['qwen3.5-plus', 'qwen3.5-max', 'qwen3.5-flash', 'qwen3-max', 'qwen3-plus', 'qwen3-mini'],
    requiresApiKey: true,
    notes: '阿里魔搭开源模型社区推理,OpenAI 协议兼容',
  },
  xai: {
    type: 'openai',
    label: 'xAI (Grok)',
    baseUrl: 'https://api.x.ai/v1',
    models: ['grok-3', 'grok-3-fast-latest', 'grok-2-vision', 'grok-2'],
    requiresApiKey: true,
    notes: 'xAI Grok 系列,OpenAI 协议兼容',
  },
  mimo: {
    type: 'openai',
    label: 'Xiaomi (MiMo)',
    baseUrl: 'https://api.xiaomimimo.com/v1',
    models: ['mimo-v2.5-pro', 'mimo-v2.5', 'mimo-v2-pro', 'mimo-v2-omni', 'mimo-v2-flash'],
    requiresApiKey: true,
    notes: '小米 MiMo 大模型,OpenAI 协议兼容',
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

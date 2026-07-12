export interface ProviderPreset {
  value: string;
  label: string;
  labelZh?: string;
  url: string;
  api: string;
  local?: boolean;
  custom?: boolean;
}

export const API_PROVIDER_PRESETS: ProviderPreset[] = [
  { value: 'ollama',      label: 'Ollama (Local)',       labelZh: 'Ollama (本地)',       url: 'http://localhost:11434/v1', api: 'openai-completions', local: true },
  { value: 'dashscope',   label: 'DashScope (Qwen)',     url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', api: 'openai-completions' },
  { value: 'openai',      label: 'OpenAI',               url: 'https://api.openai.com/v1', api: 'openai-completions' },
  { value: 'gemini',      label: 'Google Gemini',        url: 'https://generativelanguage.googleapis.com/v1beta', api: 'google-generative-ai' },
  { value: 'deepseek',    label: 'DeepSeek',             url: 'https://api.deepseek.com', api: 'openai-completions' },
  { value: 'volcengine',  label: 'Volcengine (Doubao)',  labelZh: 'Volcengine (豆包)',   url: 'https://ark.cn-beijing.volces.com/api/v3', api: 'openai-completions' },
  { value: 'moonshot',    label: 'Moonshot (Kimi)',      url: 'https://api.moonshot.cn/v1', api: 'openai-completions' },
  { value: 'kimi-coding', label: 'Kimi Coding Plan',     url: 'https://api.kimi.com/coding/', api: 'anthropic-messages' },
  { value: 'zhipu',       label: 'Zhipu (GLM)',          url: 'https://open.bigmodel.cn/api/paas/v4', api: 'openai-completions' },
  { value: 'siliconflow', label: 'SiliconFlow',          url: 'https://api.siliconflow.cn/v1', api: 'openai-completions' },
  { value: 'groq',        label: 'Groq',                 url: 'https://api.groq.com/openai/v1', api: 'openai-completions' },
  { value: 'mistral',     label: 'Mistral',              url: 'https://api.mistral.ai/v1', api: 'openai-completions' },
  { value: 'minimax',     label: 'MiniMax',              url: 'https://api.minimaxi.com/anthropic', api: 'anthropic-messages' },
  { value: 'minimax-token-plan', label: 'MiniMax Token Plan', url: 'https://api.minimaxi.com/anthropic', api: 'anthropic-messages' },
  { value: 'openrouter',  label: 'OpenRouter',           url: 'https://openrouter.ai/api/v1', api: 'openai-completions' },
  { value: 'mimo',        label: 'Xiaomi (MiMo)',        url: 'https://api.xiaomimimo.com/v1', api: 'openai-completions' },
  { value: 'mimo-token-plan', label: 'Xiaomi MiMo Token Plan', url: 'https://token-plan-cn.xiaomimimo.com/v1', api: 'openai-completions' },
  // —— 以下为扩充的常用供应商预设（用户选模板后填自己的 key 即可）——
  { value: 'baidu',       label: 'Baidu (Qianfan)',     labelZh: '百度文心 (千帆)', url: 'https://qianfan.baidubce.com/v2', api: 'openai-completions' },
  { value: 'hunyuan',     label: 'Tencent Hunyuan',      labelZh: '腾讯混元',        url: 'https://api.hunyuan.cloud.tencent.com/v1', api: 'openai-completions' },
  { value: 'step',        label: 'Step (StepFun)',       labelZh: '阶跃星辰',        url: 'https://api.stepfun.com/v1', api: 'openai-completions' },
  { value: 'baichuan',    label: 'Baichuan',             labelZh: '百川智能',        url: 'https://api.baichuan-ai.com/v1', api: 'openai-completions' },
  { value: 'yi',          label: '01.AI (Yi)',           labelZh: '零一万物',        url: 'https://api.lingyiwanwu.com/v1', api: 'openai-completions' },
  { value: 'iflytek',     label: 'iFlytek (Spark)',      labelZh: '讯飞星火',        url: 'https://spark-api-open.xf-yun.com/v1', api: 'openai-completions' },
  { value: 'together',    label: 'Together AI',          url: 'https://api.together.xyz/v1', api: 'openai-completions' },
  { value: 'perplexity',  label: 'Perplexity',           url: 'https://api.perplexity.ai', api: 'openai-completions' },
  { value: 'xai',         label: 'xAI (Grok)',           url: 'https://api.x.ai/v1', api: 'openai-completions' },
  { value: 'deepinfra',   label: 'DeepInfra',            url: 'https://api.deepinfra.com/v1/openai', api: 'openai-completions' },
  { value: 'fireworks',   label: 'Fireworks AI',         url: 'https://api.fireworks.ai/inference/v1', api: 'openai-completions' },
  { value: 'nvidia',      label: 'NVIDIA',               url: 'https://integrate.api.nvidia.com/v1', api: 'openai-completions' },
  { value: 'upstage',     label: 'Upstage (Solar)',      url: 'https://api.upstage.ai/v1/solar', api: 'openai-completions' },
  { value: 'anthropic',   label: 'Anthropic (Claude)',   url: 'https://api.anthropic.com', api: 'anthropic-messages' },
];

function currentLocale(): string | undefined {
  return typeof window === 'undefined' ? undefined : window.i18n?.locale;
}

export function getProviderPresetLabel(preset: ProviderPreset, locale = currentLocale()): string {
  return locale?.startsWith('zh') && preset.labelZh ? preset.labelZh : preset.label;
}

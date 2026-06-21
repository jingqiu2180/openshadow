// @ts-nocheck
/**
 * Provider factory — Stage 1a
 *
 * `createClient(provider)` returns an OpenAI SDK client pre-configured
 * for the provider's baseUrl/apiKey. Works for OpenAI-compatible providers
 * (OpenAI, MiniMax, DashScope, DeepSeek, Ollama) and 'custom'.
 *
 * 'gemini' is intentionally NOT supported here yet — Google Gemini's native
 * Generative Language API is not OpenAI-compatible. We expose a TODO and a
 * `isOpenAICompatible` helper so callers can decide.
 *
 * The model name is NOT passed to createClient; callers should pass it
 * to `chat.completions.create({ model, ... })` using `pickModel(provider, modelName?)`.
 */
import OpenAI from 'openai'
import type { Provider } from '../config.js'
import type { ProviderType } from './types.js'

export { createProviderAdapter, type ProviderAdapter, type ChatOptions, type ProviderChatResponse } from './adapter.js'
export { usageTracker, type UsageRecord, type UsageSummary } from './usage-tracker.js'

export function isOpenAICompatible(type: ProviderType): boolean {
  return type === 'openai' || type === 'ollama' || type === 'custom'
}

export function createClient(provider: Provider) {
  return new OpenAI({
    apiKey: provider.apiKey,
    baseURL: provider.baseUrl,
  })
}

/**
 * Pick the model to use for this provider. If `modelName` is given, use it.
 * Otherwise fall back to the first model in the provider's catalog.
 */
export function pickModel(provider: Provider, modelName?: string): string {
  if (modelName) return modelName
  if (provider.models.length > 0) return provider.models[0]
  throw new Error(
    `Provider '${provider.id}' has no models configured. ` +
    `Either specify a model in the role reference (e.g. '${provider.id}::llama3.1:8b') ` +
    `or add models to the provider's catalog.`,
  )
}

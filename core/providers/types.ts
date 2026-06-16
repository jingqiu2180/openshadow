/**
 * Provider abstraction — Stage 1a
 *
 * A Provider is a single LLM backend configuration. We support three protocols:
 *   - 'openai': OpenAI-compatible Chat Completions API (most modern Chinese providers)
 *   - 'gemini': Google Gemini Generative Language API
 *   - 'ollama': Local Ollama (OpenAI-compatible surface at /v1)
 *   - 'custom': User-supplied endpoint that speaks OpenAI protocol but is not in our catalog
 *
 * Re-exports the Provider type from config.ts so downstream code only needs one import.
 */
export { Provider } from '../config.js'

export type ProviderType = 'openai' | 'gemini' | 'ollama' | 'custom'

/**
 * A test-probe request — minimal token usage to verify the connection works.
 * Returns the latency in ms and an optional error string.
 */
export interface ConnectionTestResult {
  ok: boolean
  latencyMs: number
  modelUsed: string
  error?: string
  /** For diagnostics: what was the resolved model name */
  resolvedModel?: string
}

/**
 * Built-in provider metadata used by the wizard's dropdown.
 * We only store static metadata here; the actual Provider config is user-supplied (apiKey, model choice).
 */
export interface BuiltinProviderSpec {
  type: ProviderType
  label: string         // display name in the wizard
  baseUrl: string       // default base URL
  models: string[]      // pre-curated model list
  requiresApiKey: boolean
  notes?: string        // shown as tooltip in the wizard
}

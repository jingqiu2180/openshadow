// @ts-nocheck
/**
 * Connection tester — Stage 1a
 *
 * `testConnection(provider)` makes a minimal API call to verify credentials work
 * and reports latency. Used by the wizard's "Test connection" button.
 *
 * Strategy: for OpenAI-compatible providers, issue a `chat.completions.create`
 * with `max_tokens: 1` and the cheapest model. This is cheaper than `list models`
 * (some providers don't expose model listing) and tells us both auth + model validity.
 */
import { createClient, isOpenAICompatible, pickModel } from './index'
import type { Provider } from '../config'
import type { ConnectionTestResult } from './types'

export async function testConnection(
  provider: Provider,
  modelName?: string,
  timeoutMs: number = 15_000,
): Promise<ConnectionTestResult> {
  if (!isOpenAICompatible(provider.type)) {
    return {
      ok: false,
      latencyMs: 0,
      modelUsed: '',
      error: `Provider type '${provider.type}' is not testable yet (only OpenAI-compatible providers supported in Stage 1a).`,
    }
  }

  const client = createClient(provider)
  const model = (() => {
    try { return pickModel(provider, modelName) }
    catch (e: any) { return '' }
  })()

  if (!model) {
    return {
      ok: false,
      latencyMs: 0,
      modelUsed: '',
      error: 'No model available — add at least one model to the provider catalog.',
    }
  }

  const t0 = Date.now()
  try {
    // Race the API call against a timeout
    const result = await Promise.race([
      client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Connection test timed out after ${timeoutMs}ms`)), timeoutMs),
      ),
    ])

    return {
      ok: true,
      latencyMs: Date.now() - t0,
      modelUsed: model,
      resolvedModel: result.model,
    }
  } catch (e: any) {
    return {
      ok: false,
      latencyMs: Date.now() - t0,
      modelUsed: model,
      error: e?.message ?? String(e),
    }
  }
}

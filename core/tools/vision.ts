// @ts-nocheck
/**
 * Vision tool - analyze screenshots using multi-modal LLM.
 */

import OpenAI from 'openai'
import { captureScreenshot } from './screenshot.js'
import { getAgentConfig } from '../memory/store.js'

export interface VisionResult {
  success: true
  description: string
  findings: string[]
  text?: string
  width: number
  height: number
}

export type VisionError = { success: false; error: string }
export type VisionOutput = VisionResult | VisionError

export interface AnalyzeOptions {
  /** Question to ask about the screenshot */
  question?: string
  /** Path to screenshot file (captures if not provided) */
  imagePath?: string
  /** Specific element to look for */
  detail?: string
}

/**
 * Capture and analyze a screenshot using vision-capable LLM.
 * Supports gpt-4o, gpt-4-vision-preview, qwen-vl-max, etc.
 */
export async function analyzeScreenshot(options: AnalyzeOptions = {}): Promise<VisionOutput> {
  const config = getAgentConfig('default')
  if (!config?.apiKey) {
    return { success: false, error: 'API key not configured' }
  }

  // Capture screen if no image provided
  let base64: string
  if (options.imagePath) {
    try {
      base64 = require('fs').readFileSync(options.imagePath).toString('base64')
    } catch (e: any) {
      return { success: false, error: `Failed to read image: ${e.message}` }
    }
  } else {
    const shot = await captureScreenshot({})
    if (!shot.success) {
      return { success: false, error: `Screenshot failed: ${shot.error}` }
    }
    base64 = shot.base64
  }

  const model = config.model || 'gpt-4o'
  const defaultQuestion = options.detail
    ? `Look for "${options.detail}" in this screenshot. Describe what you see and whether it was found.`
    : options.question ?? 'Describe what you see on the screen in detail. Include any text, UI elements, buttons, windows, or relevant information.'

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  })

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: defaultQuestion },
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${base64}`, detail: 'high' },
            },
          ],
        },
      ],
      max_tokens: 1024,
    })

    const description = response.choices[0]?.message.content ?? 'No response'

    const findings = description
      .split('\\n')
      .map(s => s.replace(/^\\s*[-*•]\\s*/, '').trim())
      .filter(s => s.length > 10 && s.length < 200)

    return {
      success: true,
      description,
      findings: findings.slice(0, 10),
      text: description.replace(/\\n/g, ' |').slice(0, 500),
      width: 0,
      height: 0,
    }
  } catch (e: any) {
    const msg = e.message ?? String(e)
    if (msg.includes('vision') || msg.includes('model') || e.status === 404) {
      return {
        success: false,
        error: `Vision model not available. Current model: ${model}. Use gpt-4o or another vision-capable model.`,
      }
    }
    return { success: false, error: msg }
  }
}

export { captureScreenshot } from './screenshot.js'
export type { ScreenshotResult, ScreenshotError, ScreenshotOutput } from './screenshot.js'
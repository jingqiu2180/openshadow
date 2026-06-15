/**
 * Agent: core class with memory, personality, tools, and screen vision.
 * Supports multi-modal vision models for screenshot analysis.
 */

import OpenAI from 'openai'
import { loadPersonality } from './personality/loader.js'
import { buildSystemPrompt } from './personality/template.js'
import { getContextMemories, addMemory, getAgentConfig } from './memory/store.js'
import { PathGuard, createFileTools, createBashTools, analyzeScreenshot, captureScreenshot, mouseMove, mouseClick, mouseDrag, keyboardType, keyboardHotkey, windowActivate, getScreenSize } from './tools/index.js'

export interface AgentOptions {
  agentId: string
  allowedPaths?: string[]
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatResult {
  content: string
  toolCalls?: Array<{ name: string; args: Record<string, unknown> }>
}

/**
 * Build an OpenAI-style image message part from a base64 PNG.
 */
function imageMessagePart(base64: string): any {
  return {
    type: 'image_url',
    image_url: { url: `data:image/png;base64,${base64}`, detail: 'high' },
  }
}

export class Agent {
  private readonly client: OpenAI
  private readonly systemPrompt: string
  private readonly tools: any[]
  private readonly toolMap: Record<string, any>
  private readonly guard: PathGuard
  private readonly model: string
  /** Pending screenshots to inject as image parts in the next API call */
  private pendingImages: string[] = []

  constructor(options: AgentOptions) {
    const config = getAgentConfig(options.agentId)
    if (!config) throw new Error(`Agent config not found: ${options.agentId}`)

    this.model = config.model

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    })

    const personality = loadPersonality()
    this.systemPrompt = buildSystemPrompt(personality)

    this.guard = new PathGuard(config.allowedPaths)
    const fileTools = createFileTools(this.guard)
    const bashTools = createBashTools(this.guard)

    // ─── Tool definitions ────────────────────────────────────────────────
    const captureSpec = this.createSpec('capture_screenshot', {
      description: 'Capture a screenshot of the current screen. Returns base64 PNG image.',
      params: {
        filename: { type: 'string', description: 'Output filename', optional: true },
        directory: { type: 'string', description: 'Output directory', optional: true },
      },
    })

    const analyzeSpec = this.createSpec('analyze_screenshot', {
      description: 'Capture and analyze a screenshot using vision model. Returns detailed description of what is on screen.',
      params: {
        question: { type: 'string', description: 'Question about the screenshot', optional: true },
        detail: { type: 'string', description: 'Specific element to look for', optional: true },
      },
    })

    const fileReadSpec = this.createSpec('file_read', {
      description: 'Read contents of a file',
      params: { path: { type: 'string', description: 'Full path to the file' } },
    })

    const fileWriteSpec = this.createSpec('file_write', {
      description: 'Write content to a file',
      params: {
        path: { type: 'string', description: 'Full path to the file' },
        content: { type: 'string', description: 'Content to write' },
      },
    })

    const fileListSpec = this.createSpec('file_list', {
      description: 'List files in a directory',
      params: { path: { type: 'string', description: 'Directory path' } },
    })

    const bashSpec = this.createSpec('bash', {
      description: 'Execute a bash command',
      params: {
        command: { type: 'string', description: 'Bash command to execute' },
        cwd: { type: 'string', description: 'Working directory', optional: true },
      },
    })

    const mouseMoveSpec = this.createSpec('mouse_move', {
      description: 'Move mouse cursor to absolute screen coordinates',
      params: {
        x: { type: 'number', description: 'Target X coordinate (pixels from top-left)' },
        y: { type: 'number', description: 'Target Y coordinate (pixels from top-left)' },
      },
    })

    const mouseClickSpec = this.createSpec('mouse_click', {
      description: 'Click mouse button',
      params: {
        button: { type: 'string', description: 'Button to click: left, right, or double', optional: true },
      },
    })


    const mouseDragSpec = this.createSpec('mouse_drag', {
      description: 'Drag mouse from (x1,y1) to (x2,y2)',
      params: {
        x1: { type: 'number', description: 'Start X' }, y1: { type: 'number', description: 'Start Y' },
        x2: { type: 'number', description: 'End X' }, y2: { type: 'number', description: 'End Y' },
      },
    })

    const keyboardTypeSpec = this.createSpec('keyboard_type', {
      description: 'Type text using keyboard',
      params: { text: { type: 'string', description: 'Text to type' } },
    })

    const keyboardHotkeySpec = this.createSpec('keyboard_hotkey', {
      description: 'Press a hotkey combination',
      params: { keys: { type: 'array', items: { type: 'string' }, description: 'Key names e.g. ctrl+c, alt+tab, enter' } },
    })


    const windowActivateSpec = this.createSpec('window_activate', {
      description: 'Activate/focus a window by title pattern',
      params: { titlePattern: { type: 'string', description: 'Window title or app name to activate' } },
    })

    const screenSizeSpec = this.createSpec('get_screen_size', {
      description: 'Get the screen resolution (width x height)',
      params: {},
    })

    this.tools = [
      captureSpec, analyzeSpec,
      fileReadSpec, fileWriteSpec, fileListSpec,
      bashSpec,
      mouseMoveSpec, mouseClickSpec, mouseDragSpec,
      keyboardTypeSpec, keyboardHotkeySpec,
      windowActivateSpec, screenSizeSpec,
    ]

    this.toolMap = {
      capture_screenshot: captureScreenshot,
      analyze_screenshot: analyzeScreenshot,
      file_read: fileTools.file_read,
      file_write: fileTools.file_write,
      file_list: fileTools.file_list,
      bash: bashTools.bash,
      mouse_move: mouseMove,
      mouse_click: mouseClick,
      mouse_drag: mouseDrag,
      keyboard_type: keyboardType,
      keyboard_hotkey: keyboardHotkey,
      window_activate: windowActivate,
      get_screen_size: getScreenSize,
    }
  }

  private createSpec(name: string, def: { description: string; params: Record<string, any> }) {
    return {
      type: 'function' as const,
      function: {
        name,
        description: def.description,
        parameters: {
          type: 'object',
          properties: def.params,
          required: Object.keys(def.params).filter(k => !def.params[k]?.optional),
        },
      },
    }
  }

  /**
   * Chat with the agent. Supports:
   * - Text messages
   * - Tool execution (file/bash/screenshot/vision)
   * - Multi-modal image injection (screenshots injected as image_url parts)
   */
  async chat(messages: ChatMessage[]): Promise<ChatResult> {
    const memories = getContextMemories(20)
    const memoryContent = memories.map(m => `[${m.memory_type}] ${m.content}`).join('\n')

    const systemContent = this.systemPrompt + '\n\n## 记忆\n' + memoryContent

    // Build base messages
    const baseMessages: any[] = [
      { role: 'system', content: systemContent },
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ]

    // Inject pending screenshots as image parts into the last user message
    if (this.pendingImages.length > 0) {
      const lastMsg = baseMessages[baseMessages.length - 1]
      if (lastMsg && lastMsg.role === 'user') {
        lastMsg.content = [
          { type: 'text', text: lastMsg.content },
          ...this.pendingImages.map(b64 => imageMessagePart(b64)),
        ]
      }
      this.pendingImages = []
    }

    // ─── First call ────────────────────────────────────────────────────────
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: baseMessages,
      tools: this.tools as any,
      tool_choice: 'auto',
    })

    const choice = response.choices[0]
    if (!choice) return { content: 'No response from model' }

    if (!choice.message.tool_calls || choice.message.tool_calls.length === 0) {
      const content = choice.message.content ?? 'No response'
      this.remember(`User: ${messages[messages.length - 1]?.content} | Rem: ${content}`)
      return { content }
    }

    // ─── Tool execution ────────────────────────────────────────────────────
    const toolResults = await Promise.all(
      choice.message.tool_calls.map(async (tc: any) => {
        const name = tc.function.name as keyof typeof this.toolMap
        const args = JSON.parse(tc.function.arguments)
        const handler = this.toolMap[name]

        let result: any = { error: `No handler for ${name}` }
        if (handler) {
          try { result = await handler(args) } catch (e: any) { result = { error: e.message } }
        }

        // If screenshot was captured, remember it for next call
        if ((name === 'capture_screenshot' || name === 'analyze_screenshot') && result.success && result.base64) {
          this.pendingImages.push(result.base64)
        }

        return {
          toolCallId: tc.id,
          name,
          result,
        }
      })
    )

    // ─── Continue with tool results ────────────────────────────────────────
    const toolMessages: any[] = [
      choice.message,
      ...toolResults.map(tr => ({
        role: 'tool' as const,
        content: JSON.stringify(tr.result, null, 2),
        tool_call_id: tr.toolCallId,
      })),
    ]

    const final = await this.client.chat.completions.create({
      model: this.model,
      messages: [baseMessages[0], ...baseMessages.slice(1), ...toolMessages],
    })

    const finalContent = final.choices[0]?.message.content ?? 'No response'
    this.remember(`User: ${messages[messages.length - 1]?.content} | Rem: ${finalContent}`)
    return { content: finalContent }
  }

  remember(content: string, importance: number = 1): void {
    addMemory(content, importance, 'conversation')
  }
}
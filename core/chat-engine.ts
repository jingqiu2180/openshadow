import OpenAI from 'openai'
import { config } from './config.js'
import { createClient as createProviderClient, pickModel } from './providers/index.js'
import { getAgentConfig } from './memory/store.js'
import { injectMemoryIntoSystemPrompt } from './memory/memory-injector.js'
import { ToolRegistry, createToolSpec } from './tool-registry.js'
import { loadPersonality } from './personality/loader.js'
import { buildSystemPrompt } from './personality/template.js'
import { PathGuard } from './tools/path-guard.js'
import { createFileTools, createBashTools } from './tools/index.js'
import {
  captureScreenshot, analyzeScreenshot,
  mouseMove, mouseClick, mouseDrag,
  keyboardType, keyboardHotkey,
  windowActivate, getScreenSize,
  browserNew, browserClose, browserNavigate, browserScreenshot,
  browserClick, browserType, browserPressKey, browserGetText,
} from './tools/index.js'
import { speechToText, recordAudio } from './stt.js'
import { textToSpeech, listVoices } from './tts.js'
import { createPlanner } from './planner.js'
import { createCoderAgent } from './coder.js'
import { createSkillStore, type SkillStore } from './skills.js'
import { createTeam, type TeamLeader } from './team.js'
import { TerminalSessionManager } from './terminal/terminal-session-manager.js'
import { join } from 'path'

// 模块级 terminal manager（由 buildToolRegistry 创建）
let _terminalManager: TerminalSessionManager | null = null

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatResult {
  content: string
  toolCalls?: Array<{ name: string; args: Record<string, unknown> }>
}

function imageMessagePart(base64: string): any {
  return {
    type: 'image_url',
    image_url: { url: `data:image/png;base64,${base64}`, detail: 'high' },
  }
}

export class ChatEngine {
  private readonly client: OpenAI
  private readonly model: string
  private readonly systemPrompt: string
  private readonly toolRegistry: ToolRegistry
  private pendingImages: string[] = []
  private _planner?: ReturnType<typeof createPlanner>
  private _skillStore?: SkillStore
  private _team?: TeamLeader

  constructor(
    client: OpenAI,
    model: string,
    systemPrompt: string,
    toolRegistry: ToolRegistry,
  ) {
    this.client = client
    this.model = model
    this.systemPrompt = systemPrompt
    this.toolRegistry = toolRegistry
  }

  static createFromConfig(agentId: string, providerRole: 'main' | 'small' | 'large' = 'main', providerId?: string): ChatEngine {
    let modelName: string
    let llmClient: OpenAI

    if (config.getProviders().length > 0) {
      const provider = providerId
        ? config.getProviders().find(p => p.id === providerId) ?? null
        : config.getActiveProvider(providerRole)

      if (!provider) {
        throw new Error(
          `No provider available for role '${providerRole}' (providerId=${providerId ?? 'auto'}). ` +
          `Add a provider via the wizard or set one as default.`,
        )
      }
      modelName = pickModel(provider)
      llmClient = createProviderClient(provider)
    } else {
      const agentConfig = getAgentConfig(agentId)
      if (!agentConfig) throw new Error(`Agent config not found: ${agentId}`)
      modelName = agentConfig.model
      llmClient = new OpenAI({
        apiKey: agentConfig.apiKey,
        baseURL: agentConfig.baseUrl,
      })
    }

    const personality = loadPersonality()
    const systemPrompt = buildSystemPrompt(personality, config.getUserName())

    const dataDir = join(process.cwd(), 'data')
    const agentDir = join(dataDir, 'agents', agentId)
    const policy = config.getPathGuardPolicy(dataDir, agentDir)
    const guard = new PathGuard(policy)

    const registry = ChatEngine.buildToolRegistry(guard)

    return new ChatEngine(llmClient, modelName, systemPrompt, registry)
  }

  static buildToolRegistry(guard: PathGuard): ToolRegistry {
    const registry = new ToolRegistry()
    const fileTools = createFileTools(guard)
    const bashTools = createBashTools(guard)

    registry.register('capture_screenshot', createToolSpec('capture_screenshot', {
      description: 'Capture a screenshot of the current screen. Returns base64 PNG image.',
      params: {
        filename: { type: 'string', description: 'Output filename', optional: true },
        directory: { type: 'string', description: 'Output directory', optional: true },
      },
    }), captureScreenshot)

    registry.register('analyze_screenshot', createToolSpec('analyze_screenshot', {
      description: 'Capture and analyze a screenshot using vision model. Returns detailed description of what is on screen.',
      params: {
        question: { type: 'string', description: 'Question about the screenshot', optional: true },
        detail: { type: 'string', description: 'Specific element to look for', optional: true },
      },
    }), analyzeScreenshot)

    registry.register('file_read', createToolSpec('file_read', {
      description: 'Read contents of a file',
      params: { path: { type: 'string', description: 'Full path to the file' } },
    }), fileTools.file_read)

    registry.register('file_write', createToolSpec('file_write', {
      description: 'Write content to a file',
      params: {
        path: { type: 'string', description: 'Full path to the file' },
        content: { type: 'string', description: 'Content to write' },
      },
    }), fileTools.file_write)

    registry.register('file_list', createToolSpec('file_list', {
      description: 'List files in a directory',
      params: { path: { type: 'string', description: 'Directory path' } },
    }), fileTools.file_list)

    registry.register('bash', createToolSpec('bash', {
      description: 'Execute a bash command',
      params: {
        command: { type: 'string', description: 'Bash command to execute' },
        cwd: { type: 'string', description: 'Working directory', optional: true },
      },
    }), bashTools.bash)

    registry.register('mouse_move', createToolSpec('mouse_move', {
      description: 'Move mouse cursor to absolute screen coordinates',
      params: {
        x: { type: 'number', description: 'Target X coordinate (pixels from top-left)' },
        y: { type: 'number', description: 'Target Y coordinate (pixels from top-left)' },
      },
    }), (args: { x: number; y: number }) => mouseMove(args.x, args.y))

    registry.register('mouse_click', createToolSpec('mouse_click', {
      description: 'Click mouse button',
      params: {
        button: { type: 'string', description: 'Button to click: left, right, or double', optional: true },
      },
    }), mouseClick)

    registry.register('mouse_drag', createToolSpec('mouse_drag', {
      description: 'Drag mouse from (x1,y1) to (x2,y2)',
      params: {
        x1: { type: 'number', description: 'Start X' }, y1: { type: 'number', description: 'Start Y' },
        x2: { type: 'number', description: 'End X' }, y2: { type: 'number', description: 'End Y' },
      },
    }), (args: { x1: number; y1: number; x2: number; y2: number }) => mouseDrag(args.x1, args.y1, args.x2, args.y2))

    registry.register('keyboard_type', createToolSpec('keyboard_type', {
      description: 'Type text using keyboard',
      params: { text: { type: 'string', description: 'Text to type' } },
    }), keyboardType)

    registry.register('keyboard_hotkey', createToolSpec('keyboard_hotkey', {
      description: 'Press a hotkey combination',
      params: { keys: { type: 'array', items: { type: 'string' }, description: 'Key names e.g. ctrl+c, alt+tab, enter' } },
    }), (args: { keys: string[] }) => keyboardHotkey(...args.keys))

    registry.register('window_activate', createToolSpec('window_activate', {
      description: 'Activate/focus a window by title pattern',
      params: { titlePattern: { type: 'string', description: 'Window title or app name to activate' } },
    }), windowActivate)

    registry.register('get_screen_size', createToolSpec('get_screen_size', {
      description: 'Get the screen resolution (width x height)',
      params: {},
    }), getScreenSize)

    registry.register('browser_new', createToolSpec('browser_new', {
      description: 'Launch a new browser (Chromium) and optionally navigate to URL',
      params: {
        url: { type: 'string', description: 'URL to navigate to' },
        headless: { type: 'boolean', description: 'Run headless (default true)', optional: true },
        viewport: { type: 'object', description: '{ width, height }', optional: true },
      },
    }), browserNew)

    registry.register('browser_navigate', createToolSpec('browser_navigate', {
      description: 'Navigate browser to a URL',
      params: { url: { type: 'string', description: 'URL to navigate to' } },
    }), (args: { url: string }) => browserNavigate(args.url))

    registry.register('browser_screenshot', createToolSpec('browser_screenshot', {
      description: 'Take a screenshot of the current browser page',
      params: { fullPage: { type: 'boolean', description: 'Full page scroll capture', optional: true } },
    }), browserScreenshot)

    registry.register('browser_click', createToolSpec('browser_click', {
      description: 'Click an element by CSS selector',
      params: { selector: { type: 'string', description: 'CSS selector of element to click' } },
    }), (args: { selector: string }) => browserClick(args.selector))

    registry.register('browser_type', createToolSpec('browser_type', {
      description: 'Type text into an input field',
      params: { selector: { type: 'string', description: 'CSS selector of input field' }, text: { type: 'string', description: 'Text to type' }, pressEnter: { type: 'boolean', optional: true } },
    }), (args: { selector: string; text: string }) => browserType(args.text, args.selector))

    registry.register('browser_press_key', createToolSpec('browser_press_key', {
      description: 'Press a keyboard key',
      params: { key: { type: 'string', description: 'Key name e.g. Enter, Escape, Control+C' } },
    }), (args: { key: string }) => browserPressKey(args.key))

    registry.register('browser_get_text', createToolSpec('browser_get_text', {
      description: 'Get text content of an element',
      params: { selector: { type: 'string', description: 'CSS selector' } },
    }), (args: { selector: string }) => browserGetText(args.selector))

    registry.register('browser_close', createToolSpec('browser_close', {
      description: 'Close the browser instance',
      params: {},
    }), browserClose)

    registry.register('stt_record', createToolSpec('stt_record', {
      description: 'Record audio from microphone for speech recognition',
      params: {
        duration: { type: 'number', description: 'Recording duration in seconds', optional: true },
        outputPath: { type: 'string', description: 'Output file path', optional: true },
      },
    }), recordAudio)

    registry.register('stt_recognize', createToolSpec('stt_recognize', {
      description: 'Convert speech audio to text',
      params: { audioPath: { type: 'string', description: 'Path to audio file to transcribe' } },
    }), speechToText)

    registry.register('tts_speak', createToolSpec('tts_speak', {
      description: 'Convert text to speech and save as audio file',
      params: {
        text: { type: 'string', description: 'Text to convert to speech' },
        output: { type: 'string', description: 'Output audio file path', optional: true },
        voice: { type: 'string', description: 'Voice name (platform dependent)', optional: true },
      },
    }), textToSpeech)

    registry.register('tts_list_voices', createToolSpec('tts_list_voices', {
      description: 'List available TTS voices on this platform',
      params: {},
    }), listVoices)

    // ─── Terminal Tool (阶段1 收尾) ─────────────────────
    if (!_terminalManager) {
      _terminalManager = new TerminalSessionManager(process.cwd())
    }
    registry.register('terminal', createToolSpec('terminal', {
      description: '管理后台终端会话。用于启动长耗时进程（构建、dev server 等），然后读取输出。支持：start（启动进程）、read（读取输出）、write（写入 stdin）、close（关闭进程）、list（列出会话）。短命令直接用 bash 工具。',
      params: {
        action: { type: 'string', description: '操作：start / write / read / close / list' },
        terminal_id: { type: 'string', description: '终端 ID（start 返回的）', optional: true },
        command: { type: 'string', description: '要执行的命令（action=start 时）', optional: true },
        chars: { type: 'string', description: '写入 stdin 的字符（action=write 时）', optional: true },
        cwd: { type: 'string', description: '工作目录（action=start 时）', optional: true },
        label: { type: 'string', description: '会话标签（action=start 时）', optional: true },
        since_seq: { type: 'number', description: '只返回此 seq 之后的输出（action=read 时）', optional: true },
      },
    }), (args: any) => {
      if (!_terminalManager) return { error: 'TerminalSessionManager 未初始化' }
      const action = (args.action || '').toString().trim().toLowerCase()
      try {
        if (action === 'list') return { terminals: _terminalManager.list() }
        if (action === 'start') {
          const workDir = args.cwd || process.cwd()
          const result = _terminalManager.start({ cwd: workDir, command: args.command || '', label: args.label || '' })
          return result
        }
        if (action === 'read') {
          if (!args.terminal_id) return { error: 'terminal_id 必填（action=read）' }
          return _terminalManager.read({ terminalId: args.terminal_id, sinceSeq: args.since_seq })
        }
        if (action === 'write') {
          if (!args.terminal_id) return { error: 'terminal_id 必填（action=write）' }
          return _terminalManager.write({ terminalId: args.terminal_id, chars: args.chars || '' })
        }
        if (action === 'close') {
          if (!args.terminal_id) return { error: 'terminal_id 必填（action=close）' }
          return _terminalManager.close({ terminalId: args.terminal_id })
        }
        return { error: `未知 action: ${action}。可用：start, write, read, close, list` }
      } catch (err: any) {
        return { error: `terminal 工具错误: ${err.message}` }
      }
    })

    return registry
  }

  registerLazyTools(agent: any): void {
    this.toolRegistry.register('plan_execute', createToolSpec('plan_execute', {
      description: 'Plan and execute a complex multi-step task. Use this when a goal requires multiple steps or when unsure how to proceed.',
      params: { goal: { type: 'string', description: 'The goal or task to accomplish' } },
    }), async (args: { goal: string }) => {
      if (!this._planner) this._planner = createPlanner(agent)
      return this._planner.execute(args.goal)
    })

    this.toolRegistry.register('run_tests', createToolSpec('run_tests', {
      description: 'Run the project test suite. Returns test results.',
      params: { pattern: { type: 'string', description: 'Test pattern to filter', optional: true } },
    }), async (args: { pattern?: string }) => {
      const coder = createCoderAgent({ workspaceRoot: process.cwd(), agent })
      return coder.runTests(args.pattern)
    })

    this.toolRegistry.register('autonomous_workflow', createToolSpec('autonomous_workflow', {
      description: 'Full end-to-end coding workflow: read spec → write code → run tests → fix bugs → commit.',
      params: {
        spec: { type: 'string', description: 'Natural language description of what to build' },
        commitMessage: { type: 'string', description: 'Git commit message', optional: true },
      },
    }), async (args: { spec: string; commitMessage?: string }) => {
      const coder = createCoderAgent({ workspaceRoot: process.cwd(), agent })
      return coder.fullWorkflow(args.spec, args.commitMessage ?? 'feat: implementation')
    })

    this.toolRegistry.register('skill_list', createToolSpec('skill_list', {
      description: 'List all available skills in the skill store',
      params: { tag: { type: 'string', description: 'Filter by tag', optional: true }, search: { type: 'string', description: 'Search keyword', optional: true } },
    }), (args: { tag?: string; search?: string }) => {
      const store = this._getSkillStore()
      if (args.tag) return { skills: store.findByTag(args.tag) }
      if (args.search) return { skills: store.search(args.search) }
      return { skills: store.list() }
    })

    this.toolRegistry.register('skill_execute', createToolSpec('skill_execute', {
      description: 'Execute a skill tool',
      params: { skill: { type: 'string', description: 'Skill name' }, tool: { type: 'string', description: 'Tool name within the skill' }, args: { type: 'object', description: 'Tool arguments', optional: true } },
    }), async (args: { skill: string; tool: string; args?: Record<string, unknown> }) => {
      return this._getSkillStore().execute(args.skill, args.tool, args.args ?? {})
    })

    this.toolRegistry.register('team_dispatch', createToolSpec('team_dispatch', {
      description: 'Dispatch a complex task to the multi-agent team.',
      params: { goal: { type: 'string', description: 'High-level goal for the team' } },
    }), async (args: { goal: string }) => {
      const team = this._getTeam()
      const tasks = await team.planTasks(args.goal)
      if (tasks.length === 0) return { error: 'Could not plan tasks' }
      const results = await team.executeTasks(tasks.map(t => t.id))
      return { tasks: results }
    })

    this.toolRegistry.register('team_status', createToolSpec('team_status', {
      description: 'Get current team status',
      params: {},
    }), () => {
      const team = this._getTeam()
      return {
        workers: team.getWorkerStates(),
        pending: team.getPendingTasks(),
        sharedMemory: team.getSharedMemory().snapshot(),
      }
    })
  }

  addPendingImage(base64: string): void {
    this.pendingImages.push(base64)
  }

  getModel(): string {
    return this.model
  }

  getToolRegistry(): ToolRegistry {
    return this.toolRegistry
  }

  async chat(messages: ChatMessage[]): Promise<ChatResult> {
    const systemContent = injectMemoryIntoSystemPrompt(this.systemPrompt, messages)

    const baseMessages: any[] = [
      { role: 'system', content: systemContent },
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ]

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

    const tools = this.toolRegistry.getSpecs()
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: baseMessages,
      tools: tools as any,
      tool_choice: 'auto',
    })

    const choice = response.choices[0]
    if (!choice) return { content: 'No response from model' }

    const msg = choice.message

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      const content = msg.content ?? 'No response'
      return { content }
    }

    const toolResults = await Promise.all(
      msg.tool_calls.map(async (tc: any) => {
        const handler = this.toolRegistry.getHandler(tc.function.name)
        let result: any
        if (handler) {
          try {
            const args = JSON.parse(tc.function.arguments)
            result = await handler(args)
          } catch (e: any) {
            result = { error: e.message }
          }
        } else {
          result = { error: `Unknown tool: ${tc.function.name}` }
        }
        return {
          tool_call_id: tc.id,
          role: 'tool' as const,
          name: tc.function.name,
          content: typeof result === 'string' ? result : JSON.stringify(result),
        }
      }),
    )

    baseMessages.push(msg as any)
    baseMessages.push(...toolResults)

    const followUp = await this.client.chat.completions.create({
      model: this.model,
      messages: baseMessages,
      tools: tools as any,
      tool_choice: 'auto',
    })

    const followUpContent = followUp.choices[0]?.message?.content ?? 'No response'
    return {
      content: followUpContent,
      toolCalls: msg.tool_calls.map((tc: any) => ({
        name: tc.function.name,
        args: JSON.parse(tc.function.arguments),
      })),
    }
  }

  async chatStream(
    messages: ChatMessage[],
    onDelta: (chunk: string) => void,
  ): Promise<ChatResult> {
    const systemContent = injectMemoryIntoSystemPrompt(this.systemPrompt, messages)

    const baseMessages: any[] = [
      { role: 'system', content: systemContent },
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ]

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

    const tools = this.toolRegistry.getSpecs()
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: baseMessages,
      tools: tools as any,
      tool_choice: 'auto',
      stream: true,
    } as any)

    let fullContent = ''
    let toolCalls: any[] = []
    for await (const chunk of stream as any) {
      const delta = chunk.choices?.[0]?.delta
      if (!delta) continue

      if (delta.content) {
        fullContent += delta.content
        onDelta(delta.content)
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0
          if (!toolCalls[idx]) {
            toolCalls[idx] = { id: tc.id ?? '', function: { name: '', arguments: '' } }
          }
          if (tc.id) toolCalls[idx].id = tc.id
          if (tc.function?.name) toolCalls[idx].function.name += tc.function.name
          if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments
        }
      }
    }

    if (toolCalls.length === 0) {
      const content = fullContent || 'No response'
      return { content }
    }

    const toolResults = await Promise.all(
      toolCalls.map(async (tc: any) => {
        const handler = this.toolRegistry.getHandler(tc.function.name)
        let result: any
        if (handler) {
          try {
            const args = JSON.parse(tc.function.arguments)
            result = await handler(args)
          } catch (e: any) {
            result = { error: e.message }
          }
        } else {
          result = { error: `Unknown tool: ${tc.function.name}` }
        }
        return {
          tool_call_id: tc.id,
          role: 'tool' as const,
          name: tc.function.name,
          content: typeof result === 'string' ? result : JSON.stringify(result),
        }
      }),
    )

    baseMessages.push({
      role: 'assistant',
      content: fullContent || null,
      tool_calls: toolCalls,
    } as any)
    baseMessages.push(...toolResults)

    const followUpStream = await this.client.chat.completions.create({
      model: this.model,
      messages: baseMessages,
      tools: tools as any,
      tool_choice: 'auto',
      stream: true,
    } as any)

    let followUpContent = ''
    for await (const chunk of followUpStream as any) {
      const delta = chunk.choices?.[0]?.delta
      if (delta?.content) {
        followUpContent += delta.content
        onDelta(delta.content)
      }
    }

    return {
      content: followUpContent || fullContent || 'No response',
      toolCalls: toolCalls.map((tc: any) => ({
        name: tc.function.name,
        args: JSON.parse(tc.function.arguments),
      })),
    }
  }

  private _getSkillStore(): SkillStore {
    if (!this._skillStore) {
      this._skillStore = createSkillStore()
    }
    return this._skillStore
  }

  private _getTeam(): TeamLeader {
    if (!this._team) {
      this._team = createTeam({ chat: (msgs: ChatMessage[]) => this.chat(msgs) } as any)
    }
    return this._team
  }
}

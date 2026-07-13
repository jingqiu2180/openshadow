import OpenAI from 'openai'
import { config } from './config.js'
import { createClient as createProviderClient, pickModel } from './providers/index.js'
import { getAgentConfig } from './memory/store.js'
import { injectMemoryIntoSystemPrompt } from './memory/memory-injector.js'
import { ToolRegistry, createToolSpec } from './tool-registry.js'
import { createSubagentTool } from './subagent-tool.js'
import { loadPersonality } from './personality/loader.js'
import { buildSystemPrompt } from './personality/template.js'
import { PathGuard } from './sandbox/path-guard.js'
import { wrapPathTool, wrapBashTool } from './sandbox/tool-wrapper.js'
import { createFileTools, createBashTools, editTool, grepTool, findTool, lsTool, fileTool, stageFilesTool, checkPendingTasksTool, adaptPiTool } from './tools/index.js'
import { createCurrentStatusTool } from './tools/current-status-tool.js'
import { createSessionFoldersTool } from './tools/session-folders-tool.js'
import { registerWebSearchTool } from './tools/web-search.js'
import { registerWebFetchTool } from './tools/web-fetch.js'
import { registerTodoTool } from './tools/todo.js'
import { registerAutomationTool } from './tools/automation.js'
import { registerPinnedMemoryTool } from './tools/pinned-memory-tool.js'
import { registerNotifyTool } from './tools/notify-tool.js'
import { registerExperienceTool } from './tools/experience-tool.js'
import { registerComputerUseTool } from './tools/computer-use-tool.js'
// openhanako 对齐工具（使用 ，暂时轻量注册）
import { createChannelTool } from './tools/channel-tool.js'
import { createDmTool } from './tools/dm-tool.js'
import { createWorkflowTool } from './tools/workflow-tool.js'
// beautify 插件工具（openhanako plugins/beautify/tools/）
import { name as beautifyApplyCoverName, description as beautifyApplyCoverDesc, parameters as beautifyApplyCoverParams, execute as beautifyApplyCoverExec } from '../plugins/builtin/beautify/tools/beautify-apply-cover.js'
import { name as beautifyCreateCoverName, description as beautifyCreateCoverDesc, parameters as beautifyCreateCoverParams, execute as beautifyCreateCoverExec } from '../plugins/builtin/beautify/tools/beautify-create-cover.js'
import { name as beautifyGetCoverStyleName, description as beautifyGetCoverStyleDesc, parameters as beautifyGetCoverStyleParams, execute as beautifyGetCoverStyleExec } from '../plugins/builtin/beautify/tools/beautify-get-cover-style.js'
import { name as beautifyGetHtmlStyleName, description as beautifyGetHtmlStyleDesc, parameters as beautifyGetHtmlStyleParams, execute as beautifyGetHtmlStyleExec } from '../plugins/builtin/beautify/tools/beautify-get-html-style.js'
import { name as beautifyListCapsName, description as beautifyListCapsDesc, parameters as beautifyListCapsParams, execute as beautifyListCapsExec } from '../plugins/builtin/beautify/tools/beautify-list-capabilities.js'
// install_skill 工具（openshadow 原生实现，完整功能）
import { createInstallSkillTool } from './tools/install-skill-impl.js'
// office 插件工具（openhanako plugins/office/，）
import { name as officeReadName, description as officeReadDesc, parameters as officeReadParams, execute as officeReadExec } from '../plugins/builtin/office/tools/read-document.js'
import { name as officeHtmlToPdfName, description as officeHtmlToPdfDesc, parameters as officeHtmlToPdfParams, execute as officeHtmlToPdfExec } from '../plugins/builtin/office/tools/html-to-pdf.js'
import { name as officeListCapsName, description as officeListCapsDesc, parameters as officeListCapsParams, execute as officeListCapsExec } from '../plugins/builtin/office/tools/list-capabilities.js'
// image-gen 插件工具（openhanako plugins/image-gen/tools/，）
import { name as imgGenName, description as imgGenDesc, parameters as imgGenParams, execute as imgGenExec } from '../plugins/builtin/image-gen/tools/generate-image.js'
import { name as vidGenName, description as vidGenDesc, parameters as vidGenParams, execute as vidGenExec } from '../plugins/builtin/image-gen/tools/generate-video.js'
import { name as mediaOptsName, description as mediaOptsDesc, parameters as mediaOptsParams, execute as mediaOptsExec } from '../plugins/builtin/image-gen/tools/describe-media-options.js'
// update_settings 工具（openhanako lib/tools/update-settings-tool.ts，）
import { createUpdateSettingsTool } from './tools/update-settings-tool.js'
import { speechToText, recordAudio } from './stt.js'
import { textToSpeech, listVoices } from './tts.js'
import { createPlanner } from './planner.js'
import { createCoderAgent } from './coder.js'
import {
  captureScreenshot, analyzeScreenshot,
  mouseMove, mouseClick, mouseDrag,
  keyboardType, keyboardHotkey,
  windowActivate, getScreenSize,
  browserNew, browserClose, browserNavigate, browserScreenshot,
  browserClick, browserType, browserPressKey, browserGetText,
} from './tools/index.js'
import { createSkillStore, type SkillStore } from './skills.js'
import { createTeam, type TeamLeader } from './team.js'
import type { SessionCoordinator } from './session-coordinator.js'
import { TerminalSessionManager } from './terminal/terminal-session-manager.js'
import { join } from 'path'
import path from 'path'

// 统一解析 OpenShadow 主目录：优先环境变量，回退 cwd（单一真相源，避免 CLI/standalone 模式 cwd 不同导致配置错位）
function resolveShadowHome(): string {
  return process.env.OPENSHADOW_HOME || process.env.SHADOW_HOME || path.join(process.cwd(), '.openshadow')
}

// 模块级 terminal manager（由 buildToolRegistry 创建）
let _terminalManager: TerminalSessionManager | null = null

// 模块级 SessionCoordinator（供静态方法 buildToolRegistry 使用）
let _globalSessionCoordinator: SessionCoordinator | null = null

// 模块级 SkillStore（供 buildToolRegistry 使用）
let _globalSkillStore: any | null = null

// 模块级 AgentId（供 buildToolRegistry 使用）
let _globalAgentId: string | null = null

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
  private _agentManager?: any // AgentManager - 延迟注入
  private _permissionMode: 'operate' | 'read_only' = 'operate'

  setAgentManager(mgr: any): void {
    this._agentManager = mgr
  }

  setSessionCoordinator(coord: SessionCoordinator): void {
    _globalSessionCoordinator = coord
  }

  setSkillStore(store: any): void {
    _globalSkillStore = store
  }

  setPermissionMode(mode: 'operate' | 'read_only'): void {
    this._permissionMode = mode
  }

  getPermissionMode(): 'operate' | 'read_only' {
    return this._permissionMode
  }

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
      const keyPreview = provider.apiKey ? provider.apiKey.substring(0, 10) + '...' + provider.apiKey.substring(provider.apiKey.length - 4) : 'EMPTY'
      console.log(`[chat-engine] createFromConfig: provider=${provider.id}, model=${modelName}, baseUrl=${provider.baseUrl}, apiKey=${keyPreview}`)
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

    // 设置模块级 AgentId（供 buildToolRegistry 中的工具使用）
    _globalAgentId = agentId

    return new ChatEngine(llmClient, modelName, systemPrompt, registry)
  }

  static buildToolRegistry(guard: PathGuard): ToolRegistry {
    const registry = new ToolRegistry()
    const fileTools = createFileTools()
    const bashTools = createBashTools()
    const cwd = process.cwd()

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

    const wrappedRead = wrapPathTool({ execute: fileTools.file_read }, guard, 'read', cwd)
    registry.register('file_read', createToolSpec('file_read', {
      description: 'Read contents of a file',
      params: { path: { type: 'string', description: 'Full path to the file' } },
    }), wrappedRead.execute)

    const wrappedWrite = wrapPathTool({ execute: fileTools.file_write }, guard, 'write', cwd)
    registry.register('file_write', createToolSpec('file_write', {
      description: 'Write content to a file',
      params: {
        path: { type: 'string', description: 'Full path to the file' },
        content: { type: 'string', description: 'Content to write' },
      },
    }), wrappedWrite.execute)

    const wrappedList = wrapPathTool({ execute: fileTools.file_list }, guard, 'read', cwd)
    registry.register('file_list', createToolSpec('file_list', {
      description: 'List files in a directory',
      params: { path: { type: 'string', description: 'Directory path' } },
    }), wrappedList.execute)

    const wrappedBash = wrapBashTool({ execute: bashTools.bash }, guard, cwd)
    registry.register('bash', createToolSpec('bash', {
      description: 'Execute a bash command',
      params: {
        command: { type: 'string', description: 'Bash command to execute' },
        cwd: { type: 'string', description: 'Working directory', optional: true },
      },
    }), wrappedBash.execute)

    // ── Core tools from openhanako ──────────────────────────────────
    const wrappedEdit = wrapPathTool({ execute: editTool }, guard, 'write', cwd)
    registry.register('edit', createToolSpec('edit', {
      description: 'Edit a file by replacing oldText with newText. Returns edited file content.',
      params: {
        path: { type: 'string', description: 'Path to the file to edit' },
        oldText: { type: 'string', description: 'Text to find and replace' },
        newText: { type: 'string', description: 'Replacement text' },
        replaceAll: { type: 'boolean', description: 'Replace all occurrences', optional: true },
      },
    }), wrappedEdit.execute)

    const wrappedGrep = wrapPathTool({ execute: grepTool }, guard, 'read', cwd)
    registry.register('grep', createToolSpec('grep', {
      description: 'Search file contents for a regex pattern. Returns matching lines with file paths.',
      params: {
        pattern: { type: 'string', description: 'Regex pattern to search for' },
        path: { type: 'string', description: 'Directory to search in', optional: true },
        glob: { type: 'string', description: 'Glob pattern to filter files', optional: true },
        ignoreCase: { type: 'boolean', description: 'Case insensitive search', optional: true },
        literal: { type: 'boolean', description: 'Treat pattern as literal string', optional: true },
        context: { type: 'number', description: 'Number of context lines', optional: true },
        limit: { type: 'number', description: 'Max matches to return', optional: true },
      },
    }), wrappedGrep.execute)

    const wrappedFind = wrapPathTool({ execute: findTool }, guard, 'read', cwd)
    registry.register('find', createToolSpec('find', {
      description: 'Find files by name pattern. Returns matching file paths.',
      params: {
        pattern: { type: 'string', description: 'Glob pattern to match filenames' },
        path: { type: 'string', description: 'Directory to search in', optional: true },
        limit: { type: 'number', description: 'Max results to return', optional: true },
      },
    }), wrappedFind.execute)

    const wrappedLs = wrapPathTool({ execute: lsTool }, guard, 'read', cwd)
    registry.register('ls', createToolSpec('ls', {
      description: 'List directory contents. Supports recursive listing and formatting options.',
      params: {
        path: { type: 'string', description: 'Directory path to list' },
        all: { type: 'boolean', description: 'Include hidden files', optional: true },
        long: { type: 'boolean', description: 'Long format with details', optional: true },
        recursive: { type: 'boolean', description: 'Recursively list subdirectories', optional: true },
        depth: { type: 'number', description: 'Max recursion depth', optional: true },
        ignore: { type: 'array', items: { type: 'string' }, description: 'Patterns to ignore', optional: true },
      },
    }), wrappedLs.execute)

    // ── Unified file tool (stat + copy) ─────────────────────────
    const wrappedFile = wrapPathTool({ execute: fileTool }, guard, 'read', cwd)
    registry.register('file', createToolSpec('file', {
      description: 'File operations: stat to inspect metadata, copy to materialize a file into the workspace.',
      params: {
        action: { type: 'string', description: 'Action to perform: "stat" or "copy"' },
        path: { type: 'string', description: 'Path for stat action', optional: true },
        source: { type: 'string', description: 'Source path for copy action', optional: true },
        targetPath: { type: 'string', description: 'Destination file path for copy', optional: true },
        targetDir: { type: 'string', description: 'Destination directory for copy', optional: true },
        filename: { type: 'string', description: 'Filename when using targetDir', optional: true },
      },
    }), wrappedFile.execute)

    // ── Stage files tool ─────────────────────────────
    const wrappedStage = wrapPathTool({ execute: stageFilesTool }, guard, 'read', cwd)
    registry.register('stage_files', createToolSpec('stage_files', {
      description: 'Deliver files to the user, desktop, or Bridge platforms. Accepts local absolute paths.',
      params: {
        filepaths: { type: 'array', items: { type: 'string' }, description: 'Absolute file paths to deliver', optional: true },
        filePath: { type: 'string', description: '(Compat) Single file path', optional: true },
        label: { type: 'string', description: 'File label shown to user', optional: true },
      },
    }), wrappedStage.execute)

    // ── Check pending tasks ──────────────────────────────
    registry.register('check_pending_tasks', createToolSpec('check_pending_tasks', {
      description: 'Check the status of all background async tasks in the current conversation (image/video generation, subagent, etc.). Only returns tasks from the current conversation.',
      params: {
        status: { type: 'string', description: 'Filter by status: pending / resolved / failed. Omit to return all.', optional: true },
      },
    }), checkPendingTasksTool)

    // ── Current status (openhanako aligned) ─────────────────
    const _defaultSessionPath = process.cwd()
    const _currentStatusDeps = {
      getAgent: () => (this as any).agentManager?.getCurrentAgent?.() || null,
      getCurrentModel: () => (this as any).currentModel || null,
      getSessionFolderScope: (sessionPath: string | null) => ({
        sessionPath: sessionPath || _defaultSessionPath,
        cwd: process.cwd(),
        workspaceFolders: [process.cwd()],
        authorizedFolders: [],
        sandboxFolders: [process.cwd()],
      }),
      now: () => new Date(),
      getTimezone: () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    }
    const _currentStatusToolDef = createCurrentStatusTool(_currentStatusDeps)
    const _currentStatusHandler = adaptPiTool(
      _currentStatusToolDef,
      () => ({ sessionPath: _defaultSessionPath, engine: this }),
    )
    registry.register('current_status', createToolSpec('current_status', {
      description: _currentStatusToolDef.description,
      params: _currentStatusToolDef.parameters,
    }), _currentStatusHandler)

    // ── Session folders (openhanako aligned) ────────────────
    const _sessionFoldersToolDef = createSessionFoldersTool(_currentStatusDeps)
    const _sessionFoldersHandler = adaptPiTool(
      _sessionFoldersToolDef,
      () => ({ sessionPath: _defaultSessionPath, engine: this }),
    )
    registry.register('session_folders', createToolSpec('session_folders', {
      description: _sessionFoldersToolDef.description,
      params: _sessionFoldersToolDef.parameters,
    }), _sessionFoldersHandler)

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
      const defaultSessionPath = 'default'
      try {
        if (action === 'list') return { terminals: _terminalManager.list(defaultSessionPath) }
        if (action === 'start') {
          const workDir = args.cwd || process.cwd()
          const result = _terminalManager.start({ sessionPath: defaultSessionPath, cwd: workDir, command: args.command || '', label: args.label || '' })
          return result
        }
        if (action === 'read') {
          if (!args.terminal_id) return { error: 'terminal_id 必填（action=read）' }
          return _terminalManager.read({ sessionPath: defaultSessionPath, terminalId: args.terminal_id, sinceSeq: args.since_seq })
        }
        if (action === 'write') {
          if (!args.terminal_id) return { error: 'terminal_id 必填（action=write）' }
          return _terminalManager.write({ sessionPath: defaultSessionPath, terminalId: args.terminal_id, chars: args.chars || '' })
        }
        if (action === 'close') {
          if (!args.terminal_id) return { error: 'terminal_id 必填（action=close）' }
          return _terminalManager.close({ sessionPath: defaultSessionPath, terminalId: args.terminal_id })
        }
        return { error: `未知 action: ${action}。可用：start, write, read, close, list` }
      } catch (err: any) {
        return { error: `terminal 工具错误: ${err.message}` }
      }
    })

    // ─── Web & Productivity Tools (阶段2 补齐) ─────────────
    registerWebSearchTool(registry)
    registerWebFetchTool(registry)
    registerTodoTool(registry)
    registerAutomationTool(registry)

    // ─── Pinned Memory Tool ─────────────
    registerPinnedMemoryTool(registry)

    // ─── Notify Tool ─────────────
    registerNotifyTool(registry)

    // ─── Experience Tool ─────────────
    registerExperienceTool(registry)

    // ─── Computer Use Tool ─────────────
    registerComputerUseTool(registry)

    // ─── openhanako 对齐工具（轻量实现）─────────────
    // Channel 工具（频道聊天）
    try {
      const _channelsDir = path.join(resolveShadowHome(), 'channels')
      const _agentsDir = path.join(resolveShadowHome(), 'agents')
      const _agentId = (this as any).agentId || 'main'
      const _channelDeps = {
        agentId: _agentId,
        channelsDir: _channelsDir,
        agentsDir: _agentsDir,
        listAgents: () => {
          try {
            const entries = require('fs').readdirSync(_agentsDir, { withFileTypes: true })
              .filter((e: any) => e.isFile() && e.name.endsWith('.json'))
              .map((e: any) => e.name.replace(/.json$/, ''))
            return entries.length > 0 ? entries : ['main', 'coder', 'planner']
          } catch { return ['main', 'coder', 'planner'] }
        },
        onPost: () => {}, // stub - 发送消息后的回调
        isEnabled: () => true,
        createChannelEntry: () => {}, // stub - 创建频道条目的回调
      }
      const _channelToolDef = createChannelTool(_channelDeps)
      const _channelHandler = adaptPiTool(
        _channelToolDef,
        () => ({ sessionPath: process.cwd(), engine: this }),
      )
      registry.register('channel', createToolSpec('channel', {
        description: _channelToolDef.description,
        params: _channelToolDef.parameters,
      }), _channelHandler)
    } catch (e) {
      console.error('[openshadow] Failed to register channel tool:', e)
    }

    // DM 工具（私信）
    try {
      const _agentsDir = path.join(resolveShadowHome(), 'agents')
      const _agentId = (this as any).agentId || 'main'
      const _dmDeps = {
        agentId: _agentId,
        agentsDir: _agentsDir,
        listAgents: () => {
          try {
            const entries = require('fs').readdirSync(_agentsDir, { withFileTypes: true })
              .filter((e: any) => e.isFile() && e.name.endsWith('.json'))
              .map((e: any) => e.name.replace(/.json$/, ''))
            return entries.length > 0 ? entries : ['main', 'coder', 'planner']
          } catch { return ['main', 'coder', 'planner'] }
        },
        onDmSent: () => {}, // stub - 发送 DM 后的回调
        isEnabled: () => true,
      }
      const _dmToolDef = createDmTool(_dmDeps)
      const _dmHandler = adaptPiTool(
        _dmToolDef,
        () => ({ sessionPath: process.cwd(), engine: this }),
      )
      registry.register('dm', createToolSpec('dm', {
        description: _dmToolDef.description,
        params: _dmToolDef.parameters,
      }), _dmHandler)
    } catch (e) {
      console.error('[openshadow] Failed to register dm tool:', e)
    }

    // ─── Workflow 工具（编排脚本）─────────────
    try {
      const _agentId = (this as any).agentId || 'main'
      const _workflowDeps = {
        executeIsolated: _globalSessionCoordinator?.executeIsolated?.bind(_globalSessionCoordinator),
        getAgentId: () => _agentId,
        isEnabled: () => true,
        // stub 依赖项（后续完善）
        getSessionPath: () => process.cwd(),
        getParentCwd: () => process.cwd(),
        emitEvent: () => {},
        resolveAgentId: () => undefined,
        getDeferredStore: () => null,
        getSubagentRunStore: () => null,
        getSubagentThreadStore: () => null,
        getJournalDir: () => null,
      }
      const _workflowToolDef = createWorkflowTool(_workflowDeps)
      const _workflowHandler = adaptPiTool(
        _workflowToolDef,
        () => ({ sessionPath: process.cwd(), engine: this }),
      )
      registry.register('workflow', createToolSpec('workflow', {
        description: _workflowToolDef.description,
        params: _workflowToolDef.parameters,
      }), _workflowHandler)
    } catch (e) {
      console.error('[openshadow] Failed to register workflow tool:', e)
    }

    // ─── Beautify 插件工具（openhanako 对齐）─────────────
    try {
      const _beautifyDeps = () => ({ sessionPath: process.cwd(), engine: this })
      
      // apply-cover-candidate
      registry.register('beautify_apply_cover', createToolSpec(beautifyApplyCoverName, {
        description: beautifyApplyCoverDesc,
        params: beautifyApplyCoverParams,
      }), adaptPiTool(
        { name: beautifyApplyCoverName, description: beautifyApplyCoverDesc, parameters: beautifyApplyCoverParams, execute: beautifyApplyCoverExec },
        _beautifyDeps
      ))
      
      // create-cover
      registry.register('beautify_create_cover', createToolSpec(beautifyCreateCoverName, {
        description: beautifyCreateCoverDesc,
        params: beautifyCreateCoverParams,
      }), adaptPiTool(
        { name: beautifyCreateCoverName, description: beautifyCreateCoverDesc, parameters: beautifyCreateCoverParams, execute: beautifyCreateCoverExec },
        _beautifyDeps
      ))
      
      // get-cover-style-guide
      registry.register('beautify_get_cover_style', createToolSpec(beautifyGetCoverStyleName, {
        description: beautifyGetCoverStyleDesc,
        params: beautifyGetCoverStyleParams,
      }), adaptPiTool(
        { name: beautifyGetCoverStyleName, description: beautifyGetCoverStyleDesc, parameters: beautifyGetCoverStyleParams, execute: beautifyGetCoverStyleExec },
        _beautifyDeps
      ))
      
      // get-html-style-guide
      registry.register('beautify_get_html_style', createToolSpec(beautifyGetHtmlStyleName, {
        description: beautifyGetHtmlStyleDesc,
        params: beautifyGetHtmlStyleParams,
      }), adaptPiTool(
        { name: beautifyGetHtmlStyleName, description: beautifyGetHtmlStyleDesc, parameters: beautifyGetHtmlStyleParams, execute: beautifyGetHtmlStyleExec },
        _beautifyDeps
      ))
      
      // list-capabilities
      registry.register('beautify_list_caps', createToolSpec(beautifyListCapsName, {
        description: beautifyListCapsDesc,
        params: beautifyListCapsParams,
      }), adaptPiTool(
        { name: beautifyListCapsName, description: beautifyListCapsDesc, parameters: beautifyListCapsParams, execute: beautifyListCapsExec },
        _beautifyDeps
      ))
    } catch (e) {
      console.error('[openshadow] Failed to register beautify tools:', e)
    }

    // ─── office 工具（openhanako plugins/office/）─────────────
    try {
      // read-document
      registry.register('office_read_document', createToolSpec(officeReadName, {
        description: officeReadDesc,
        params: officeReadParams,
      }), officeReadExec)
      // list-capabilities
      registry.register('office_list_caps', createToolSpec(officeListCapsName, {
        description: officeListCapsDesc,
        params: officeListCapsParams,
      }), officeListCapsExec)
      // html-to-pdf（依赖 Chromium helper，execute 有2个参数，用 wrapper 适配）
      registry.register('office_html_to_pdf', createToolSpec(officeHtmlToPdfName, {
        description: officeHtmlToPdfDesc,
        params: officeHtmlToPdfParams,
      }), (args: any) => officeHtmlToPdfExec(args, {}))
    } catch (e) {
      console.error('[openshadow] Failed to register office tools:', e)
    }

    // ─── image-gen 工具（openhanako plugins/image-gen/）─────────────
    try {
      registry.register('generate_image', createToolSpec(imgGenName, {
        description: imgGenDesc,
        params: imgGenParams,
      }), (args: any) => imgGenExec(args, {}))
      registry.register('generate_video', createToolSpec(vidGenName, {
        description: vidGenDesc,
        params: vidGenParams,
      }), (args: any) => vidGenExec(args, {}))
      registry.register('describe_media_options', createToolSpec(mediaOptsName, {
        description: mediaOptsDesc,
        params: mediaOptsParams,
      }), (args: any) => mediaOptsExec(args, {}))
    } catch (e) {
      console.error('[openshadow] Failed to register image-gen tools:', e)
    }

    // ─── install_skill 工具（openshadow 原生完整实现）─────────────
    try {
      const { spec, executor } = createInstallSkillTool(
        _globalSkillStore,
        () => {
          const activeProvider = config.getActiveProvider('main')
          if (activeProvider) {
            return {
              model: pickModel(activeProvider),
              apiKey: activeProvider.apiKey || '',
              baseUrl: activeProvider.baseUrl || '',
            }
          }
          return { model: 'deepseek-chat', apiKey: '', baseUrl: 'https://api.deepseek.com' }
        },
        null,
      )
      registry.register('install_skill', spec, executor)
    } catch (e) {
      console.error('[openshadow] Failed to register install_skill tool:', e)
    }

    // ─── update_settings 工具（openhanako lib/tools/update-settings-tool.ts）──
    try {
      const _updateSettingsDeps = {
        getEngine: () => this,
        getAgent: () => _globalAgentId ? getAgentConfig(_globalAgentId) : null,
      }
      const updateSettingsTool = createUpdateSettingsTool(_updateSettingsDeps)
      // execute 有5个参数 (_toolCallId, params, _signal, _onUpdate, _ctx)，用 wrapper 适配
      const wrappedExecute = (args: any) => updateSettingsTool.execute('', args, null, null, null)
      registry.register('update_settings', createToolSpec(updateSettingsTool.name, {
        description: updateSettingsTool.description,
        params: updateSettingsTool.parameters,
      }), wrappedExecute)
    } catch (e) {
      console.error('[openshadow] Failed to register update_settings tool:', e)
    }

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

    // ─── Subagent 工具（对齐 openhanako）──
    const _subagentTools = createSubagentTool({
      chat: (msgs: Array<{ role: 'user' | 'system' | 'assistant'; content: string }>, userId?: string) =>
        this.chat(msgs, userId ?? 'default'),
      createReadOnlyChat: () => {
        const clone = this.createReadOnlyClone()
        return (msgs: Array<{ role: 'user' | 'system' | 'assistant'; content: string }>, userId?: string) =>
          clone.chat(msgs, userId ?? 'default')
      },
      getModel: () => this.model,
      getAgentManager: () => this._getAgentManager(),
      getSessionPermission: () => this.getPermissionMode(),
      getCwd: () => process.cwd(),
    })

    this.toolRegistry.register('subagent', createToolSpec('subagent', {
      description: _subagentTools.subagent.description,
      params: _subagentTools.subagent.parameters,
    }), _subagentTools.subagent.execute)

    this.toolRegistry.register('subagent_reply', createToolSpec('subagent_reply', {
      description: _subagentTools.subagent_reply.description,
      params: _subagentTools.subagent_reply.parameters,
    }), _subagentTools.subagent_reply.execute)

    this.toolRegistry.register('subagent_close', createToolSpec('subagent_close', {
      description: _subagentTools.subagent_close.description,
      params: _subagentTools.subagent_close.parameters,
    }), _subagentTools.subagent_close.execute)

    this.toolRegistry.register('subagent_status', createToolSpec('subagent_status', {
      description: _subagentTools.subagent_status.description,
      params: _subagentTools.subagent_status.parameters,
    }), _subagentTools.subagent_status.execute)
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

  /**
   * 创建只读副本，只注册只读工具。
   * subagent access="read" 时使用。
   */
  createReadOnlyClone(): ChatEngine {
    const READ_ONLY_TOOLS = [
      'capture_screenshot',
      'analyze_screenshot',
      'file_read',
      'file_list',
      'get_screen_size',
      'memory_search',
      'memory_get',
      'memory_list',
      'web_fetch',
      'web_search',
      'subagent',
      'subagent_reply',
      'subagent_close',
      'subagent_status',
    ]

    const newRegistry = new ToolRegistry()
    for (const name of READ_ONLY_TOOLS) {
      const entry = this.toolRegistry.get(name)
      if (entry) {
        newRegistry.registerEntry(name, entry)
      }
    }

    const clone = new ChatEngine(this.client, this.model, this.systemPrompt, newRegistry)
    // 注入 SkillStore（复用模块级实例）
    if (_globalSkillStore) {
      clone.setSkillStore(_globalSkillStore)
    }
    return clone
  }

  async chat(messages: ChatMessage[], userId: string = 'default'): Promise<ChatResult> {
    const systemContent = await injectMemoryIntoSystemPrompt(this.systemPrompt, messages, { userId })

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
    userId: string = 'default',
  ): Promise<ChatResult> {
    const systemContent = await injectMemoryIntoSystemPrompt(this.systemPrompt, messages, { userId })

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

  private _getAgentManager(): any | null {
    return this._agentManager ?? null
  }
}

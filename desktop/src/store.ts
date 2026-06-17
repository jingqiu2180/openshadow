import { create } from 'zustand'

// ─── Content Block Types ─────────────────────────────────────
export type ContentBlockType = 'text' | 'thinking' | 'tool_group' | 'image' | 'file' | 'interlude' | 'mood' | 'plugin_card' | 'todo' | 'workflow' | 'subagent' | 'settings_confirm' | 'settings_update'

export interface ContentBlock {
  id: string
  type: ContentBlockType
  /** text / thinking: 文本内容 */
  content: string
  /** tool_group: 工具调用列表 */
  tools?: Array<{ name: string; status: 'running' | 'success' | 'error'; output?: string }>
  /** 是否为流式中（thinking 或 tool_group 正在更新） */
  streaming?: boolean
  /** 时间戳 */
  timestamp?: number
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  /** 结构化 blocks（为空时退化为 content 纯文本） */
  blocks?: ContentBlock[]
  timestamp: number
  /** 编辑消息 ID（重编辑后指向的原消息） */
  editedFrom?: string
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  active: boolean
  updatedAt?: number
  pinned?: boolean
  archived?: boolean
}

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modified: string
  /** "text" | "image" | "binary" — used by desk panel to render previews */
  kind?: 'text' | 'image' | 'binary'
  /** data: URL for image preview, or text content for small text files */
  preview?: string
}

export interface ModelInfo {
  /** "minimax" | "openai" | ... */
  provider: string
  /** "abab6.5s-chat" | "gpt-4o" | ... */
  model: string
  /** 显示名 */
  label?: string
}

export type ThinkingLevel = 'off' | 'low' | 'medium' | 'high'
export type PermissionMode = 'auto' | 'ask' | 'read_only' | 'operate'

interface AppState {
  conversations: Conversation[]
  currentId: string | null
  files: FileEntry[]
  deskPath: string
  tree: TreeNode[]

  /** A one-shot prompt injected into ChatArea by other components */
  pendingPrompt: string | null
  /** Sidebar 会话搜索关键词 */
  searchQuery: string
  /** 引用选区 — 鼠标选中消息文本后注入的引用片段 */
  quotedSelection: string | null
  /** 已选文件/附件 — 发送时随 prompt 一起提交 */
  attachedFiles: FileEntry[]
  /** 当前会话 TODO 列表 */
  sessionTodos: Array<{ id: string; content: string; status: 'pending' | 'in_progress' | 'completed' | 'failed'; activeForm?: string }>
  /** 当前 agent 活动 step */
  agentActivity: { step: string; elapsed: number; lastResult?: string } | null
  /** 工作流进度（skill 调用时） */
  workflow: { id: string; name: string; steps: Array<{ name: string; status: 'pending' | 'running' | 'done' | 'error' }>; currentStep: number } | null
  /** 待确认配置变更 */
  settingsConfirm: { id: string; key: string; oldValue: any; newValue: any; description: string } | null
  /** 工具/操作执行前的会话级确认 prompt (allow once / always / deny) */
  confirmationPrompt: {
    id: string
    title: string
    description: string
    toolName?: string
    args?: any
  } | null
  /** 解析确认结果 */
  resolveConfirmation: (choice: 'allow' | 'always' | 'deny') => void
  /** 自动应用配置更新（无确认） */
  settingsUpdate: { id: string; key: string; newValue: any; description: string } | null
  /** 能力漂移提示（启动时检测到不匹配） */
  capabilityDrift: { severity: 'info' | 'warning' | 'error'; title: string; detail: string; dismissable: boolean } | null

  settings: {
    workspaceRoots: string[]
    allowExternalReads: boolean
    sandbox: boolean
    theme: 'warm-paper' | 'cool-night' | 'auto'
    loaded: boolean
  }

  /** 当前激活的模型（main role） */
  currentModel: ModelInfo
  /** 所有可用模型（来自 config.json providers） */
  availableModels: ModelInfo[]
  /** 思考深度 */
  thinkingLevel: ThinkingLevel
  /** 操作前问问 / plan mode */
  permissionMode: PermissionMode
  /** 记忆开关 */
  memoryOn: boolean
  /** 模型加载状态 */
  modelsLoaded: boolean

  // Chat
  addMessage: (convId: string, msg: Message) => void
  deleteMessage: (convId: string, msgTimestamp: number) => void
  updateMessage: (convId: string, msgTimestamp: number, content: string) => void
  newConversation: () => string
  setActive: (id: string) => void
  renameConversation: (id: string, title: string) => void
  deleteConversation: (id: string) => void
  togglePin: (id: string) => void
  archiveConversation: (id: string) => void

  // Status / Toast
  wsStatus: 'connected' | 'connecting' | 'disconnected' | 'error'
  toasts: Array<{ id: string; type: 'success' | 'error' | 'info'; text: string }>
  setWsStatus: (s: 'connected' | 'connecting' | 'disconnected' | 'error') => void
  pushToast: (type: 'success' | 'error' | 'info', text: string) => void
  dismissToast: (id: string) => void

  // Desk
  setFiles: (files: FileEntry[]) => void
  addFile: (file: FileEntry) => void
  addFiles: (files: FileEntry[]) => void
  removeFile: (index: number) => void
  setDeskPath: (path: string) => void
  setTree: (tree: TreeNode[]) => void
  refreshTree: () => Promise<void>
  createFile: (parentPath: string, name: string) => Promise<boolean>
  createFolder: (parentPath: string, name: string) => Promise<boolean>
  renameFileNode: (oldPath: string, newName: string) => Promise<boolean>
  deleteFileNode: (path: string) => Promise<boolean>
  copyToClipboard: (text: string) => Promise<void>

  // Cross-component
  setPendingPrompt: (prompt: string | null) => void
  setSearchQuery: (q: string) => void
  setQuotedSelection: (q: string | null) => void
  addAttachedFile: (f: FileEntry) => void
  removeAttachedFile: (index: number) => void
  clearAttachedFiles: () => void
  setSessionTodos: (todos: AppState['sessionTodos']) => void
  updateTodo: (id: string, status: AppState['sessionTodos'][number]['status']) => void
  clearSessionTodos: () => void
  setAgentActivity: (a: AppState['agentActivity']) => void
  setWorkflow: (w: AppState['workflow']) => void
  setSettingsConfirm: (s: AppState['settingsConfirm']) => void
  resolveSettingsConfirm: (accept: boolean) => void
  setConfirmationPrompt: (p: AppState['confirmationPrompt']) => void
  setSettingsUpdate: (s: AppState['settingsUpdate']) => void
  setCapabilityDrift: (c: AppState['capabilityDrift']) => void

  // Settings
  loadSettings: () => Promise<void>
  saveSettings: () => Promise<void>
  setSettings: (partial: Partial<AppState['settings']>) => void
  setTheme: (theme: AppState['settings']['theme']) => void
  loadModels: () => Promise<void>
  setCurrentModel: (m: ModelInfo) => Promise<void>
  setThinkingLevel: (l: ThinkingLevel) => void
  setPermissionMode: (m: PermissionMode) => void
  setMemoryOn: (on: boolean) => Promise<void>
}

export interface TreeNode {
  name: string
  path: string
  isDirectory: boolean
  size: number
  children?: TreeNode[]
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }

const PERSIST_KEY = 'rem.conversations.v1'
const THINK_KEY = 'rem.thinkingLevel'
const PERM_KEY = 'rem.permissionMode'
const MEM_KEY = 'rem.memoryOn'
const MODEL_KEY = 'rem.currentModel'

function loadPersistedConversations(): Conversation[] {
  if (typeof localStorage === 'undefined') return [{ id: 'default', title: '新对话', messages: [], active: true, updatedAt: Date.now() }]
  try {
    const raw = localStorage.getItem(PERSIST_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return [{ id: 'default', title: '新对话', messages: [], active: true, updatedAt: Date.now() }]
}

function persistConversations(convs: Conversation[]) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(PERSIST_KEY, JSON.stringify(convs))
  } catch {}
}

export const useStore = create<AppState>((set, get) => ({
  conversations: loadPersistedConversations(),
  currentId: loadPersistedConversations()[0]?.id ?? 'default',
  files: [],
  deskPath: '',
  tree: [],
  pendingPrompt: null,
  searchQuery: '',
  quotedSelection: null,
  attachedFiles: [] as FileEntry[],
  sessionTodos: [] as AppState['sessionTodos'],
  agentActivity: null,
  workflow: null,
  settingsConfirm: null,
  settingsUpdate: null,
  capabilityDrift: null,
  confirmationPrompt: null,

  settings: {
    workspaceRoots: [],
    allowExternalReads: true,
    sandbox: true,
    theme: (typeof localStorage !== 'undefined' && (localStorage.getItem('rem.theme') as any)) || 'warm-paper',
    loaded: false,
  },

  currentModel: (() => {
    if (typeof localStorage === 'undefined') return { provider: 'minimax', model: 'abab6.5s-chat' }
    try {
      const raw = localStorage.getItem(MODEL_KEY)
      if (raw) return JSON.parse(raw)
    } catch {}
    return { provider: 'minimax', model: 'abab6.5s-chat' }
  })(),
  availableModels: [],
  thinkingLevel: (typeof localStorage !== 'undefined' && (localStorage.getItem(THINK_KEY) as any)) || 'off',
  permissionMode: (typeof localStorage !== 'undefined' && (localStorage.getItem(PERM_KEY) as any)) || 'ask',
  memoryOn: (() => {
    if (typeof localStorage === 'undefined') return true
    const v = localStorage.getItem(MEM_KEY)
    return v === null ? true : v === '1'
  })(),
  modelsLoaded: false,

  wsStatus: 'disconnected' as 'connected' | 'connecting' | 'disconnected' | 'error',
  toasts: [],

  addMessage: (convId, msg) => {
    set(state => {
      const conversations = state.conversations.map(c =>
        c.id === convId ? { ...c, messages: [...c.messages, msg], updatedAt: Date.now() } : c
      )
      persistConversations(conversations)
      return { conversations }
    })
  },

  deleteMessage: (convId, msgTimestamp) => {
    set(state => {
      const conversations = state.conversations.map(c => {
        if (c.id !== convId) return c
        const messages = c.messages.filter(m => m.timestamp !== msgTimestamp)
        return { ...c, messages, updatedAt: Date.now() }
      })
      persistConversations(conversations)
      return { conversations }
    })
  },

  updateMessage: (convId, msgTimestamp, content) => {
    set(state => {
      const conversations = state.conversations.map(c => {
        if (c.id !== convId) return c
        const messages = c.messages.map(m =>
          m.timestamp === msgTimestamp ? { ...m, content } : m
        )
        return { ...c, messages, updatedAt: Date.now() }
      })
      persistConversations(conversations)
      return { conversations }
    })
  },

  newConversation: () => {
    const id = genId()
    set(state => {
      const conversations = [
        ...state.conversations.map(c => ({ ...c, active: false })),
        { id, title: '新对话', messages: [], active: true, updatedAt: Date.now() }
      ]
      persistConversations(conversations)
      return { conversations, currentId: id }
    })
    return id
  },

  setActive: (id) => {
    set(state => ({
      currentId: id,
      conversations: state.conversations.map(c => ({ ...c, active: c.id === id, updatedAt: c.id === id ? Date.now() : c.updatedAt }))
    }))
  },

  renameConversation: (id, title) => {
    set(state => {
      const conversations = state.conversations.map(c =>
        c.id === id ? { ...c, title, updatedAt: Date.now() } : c
      )
      persistConversations(conversations)
      return { conversations }
    })
  },

  deleteConversation: (id) => {
    set(state => {
      const conversations = state.conversations.filter(c => c.id !== id)
      const currentId = state.currentId === id
        ? (conversations[0]?.id ?? null)
        : state.currentId
      persistConversations(conversations)
      return { conversations, currentId }
    })
  },

  togglePin: (id) => {
    set(state => {
      const conversations = state.conversations.map(c =>
        c.id === id ? { ...c, pinned: !c.pinned } : c
      )
      persistConversations(conversations)
      return { conversations }
    })
  },

  archiveConversation: (id) => {
    set(state => {
      const conversations = state.conversations.map(c =>
        c.id === id ? { ...c, archived: !c.archived } : c
      )
      persistConversations(conversations)
      return { conversations }
    })
  },

  setFiles: (files) => set({ files }),
  addFile: (file) => set(state => ({ files: [...state.files, file] })),
  addFiles: (files) => set(state => ({ files: [...state.files, ...files] })),
  removeFile: (index) => set(state => ({ files: state.files.filter((_, i) => i !== index) })),
  setDeskPath: (deskPath) => set({ deskPath }),
  setTree: (tree) => set({ tree }),
  refreshTree: async () => {
    const { settings } = get()
    const root = settings.workspaceRoots[0]
    if (!root) { set({ tree: [] }); return }
    try {
      const res = await fetch(`http://localhost:3000/api/fs/tree?path=${encodeURIComponent(root)}&depth=3`)
      const data = await res.json()
      set({ tree: data.tree ?? [], deskPath: root })
    } catch (e) {
      console.error('refreshTree failed:', e)
    }
  },

  createFile: async (parentPath: string, name: string) => {
    try {
      const res = await fetch('http://localhost:3000/api/fs/file', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentPath, name }),
      })
      if (!res.ok) return false
      await get().refreshTree()
      return true
    } catch (e) { console.error('createFile failed:', e); return false }
  },

  createFolder: async (parentPath: string, name: string) => {
    try {
      const res = await fetch('http://localhost:3000/api/fs/folder', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentPath, name }),
      })
      if (!res.ok) return false
      await get().refreshTree()
      return true
    } catch (e) { console.error('createFolder failed:', e); return false }
  },

  renameFileNode: async (oldPath: string, newName: string) => {
    try {
      const res = await fetch('http://localhost:3000/api/fs/rename', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPath, newName }),
      })
      if (!res.ok) return false
      await get().refreshTree()
      return true
    } catch (e) { console.error('renameFileNode failed:', e); return false }
  },

  deleteFileNode: async (path: string) => {
    try {
      const res = await fetch(`http://localhost:3000/api/fs?path=${encodeURIComponent(path)}`, {
        method: 'DELETE',
      })
      if (!res.ok) return false
      await get().refreshTree()
      return true
    } catch (e) { console.error('deleteFileNode failed:', e); return false }
  },

  copyToClipboard: async (text: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for non-secure contexts
        const ta = document.createElement('textarea')
        ta.value = text
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
    } catch (e) { console.error('copyToClipboard failed:', e) }
  },

  setPendingPrompt: (pendingPrompt) => set({ pendingPrompt }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setQuotedSelection: (quotedSelection) => set({ quotedSelection }),
  addAttachedFile: (f) => set(s => ({ attachedFiles: [...s.attachedFiles, f] })),
  removeAttachedFile: (index) => set(s => ({ attachedFiles: s.attachedFiles.filter((_, i) => i !== index) })),
  clearAttachedFiles: () => set({ attachedFiles: [] }),
  setSessionTodos: (sessionTodos) => set({ sessionTodos }),
  updateTodo: (id, status) => set(s => ({
    sessionTodos: s.sessionTodos.map(t => t.id === id ? { ...t, status } : t)
  })),
  clearSessionTodos: () => set({ sessionTodos: [] }),
  setAgentActivity: (agentActivity) => set({ agentActivity }),
  setWorkflow: (workflow) => set({ workflow }),
  setSettingsConfirm: (settingsConfirm) => set({ settingsConfirm }),
  resolveSettingsConfirm: (accept) => {
    const s = get().settingsConfirm
    if (!s) return
    // TODO: 真实场景写回 config
    set({ settingsConfirm: null })
  },
  setSettingsUpdate: (settingsUpdate) => set({ settingsUpdate }),
  setCapabilityDrift: (capabilityDrift) => set({ capabilityDrift }),
  setConfirmationPrompt: (confirmationPrompt) => set({ confirmationPrompt }),
  resolveConfirmation: (choice) => {
    set({ confirmationPrompt: null })
    // TODO: 真实场景把选择发送回 agent
    void choice
  },

  loadSettings: async () => {
    try {
      const res = await fetch('http://localhost:3000/api/config/security')
      const data = await res.json()
      set(state => {
        const workspaceRoots = data.workspaceRoots ?? state.settings.workspaceRoots
        return {
          settings: {
            ...state.settings,
            workspaceRoots,
            allowExternalReads: data.allowExternalReads ?? true,
            sandbox: data.sandbox ?? true,
            loaded: true,
          }
        }
      })
      // Auto-refresh tree when workspace changes
      get().refreshTree()
    } catch (e) {
      console.error('loadSettings failed:', e)
    }
  },

  saveSettings: async () => {
    const { settings } = get()
    try {
      await fetch('http://localhost:3000/api/config/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
    } catch (e) {
      console.error('saveSettings failed:', e)
    }
  },

  setSettings: (partial) => {
    set(state => ({ settings: { ...state.settings, ...partial } }))
  },

  setTheme: async (theme) => {
    set(state => ({ settings: { ...state.settings, theme } }))
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('rem.theme', theme)
    }
    document.documentElement.setAttribute('data-theme', theme)
    try {
      await fetch('http://localhost:3000/api/config/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme }),
      })
    } catch (e) {
      console.warn('[theme] save to server failed:', e)
    }
  },

  loadModels: async () => {
    if (get().modelsLoaded) return
    try {
      const res = await fetch('http://localhost:3000/api/config')
      const data = await res.json()
      const models: ModelInfo[] = []
      if (Array.isArray(data.providers)) {
        for (const p of data.providers) {
          const list = p.models ?? []
          for (const m of list) {
            models.push({ provider: p.id, model: m, label: `${p.label ?? p.id} · ${m}` })
          }
        }
      }
      set({ availableModels: models, modelsLoaded: true })
    } catch (e) {
      console.error('loadModels failed:', e)
    }
  },

  setCurrentModel: async (m) => {
    set({ currentModel: m })
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MODEL_KEY, JSON.stringify(m))
    }
    try {
      const res = await fetch('http://localhost:3000/api/models/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: m.provider, model: m.model }),
      })
      if (!res.ok) {
        get().pushToast('error', '切换模型失败（后端）')
      } else {
        get().pushToast('success', `已切换到 ${m.model}`)
      }
    } catch (e) {
      console.warn('[model] save to server failed:', e)
      get().pushToast('error', '切换模型失败（网络）')
    }
  },

  setThinkingLevel: (l) => {
    set({ thinkingLevel: l })
    if (typeof localStorage !== 'undefined') localStorage.setItem(THINK_KEY, l)
  },

  setPermissionMode: (m) => {
    set({ permissionMode: m })
    if (typeof localStorage !== 'undefined') localStorage.setItem(PERM_KEY, m)
    fetch('http://localhost:3000/api/permissions/set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: m }),
    }).catch(() => {})
  },

  setWsStatus: (wsStatus) => set({ wsStatus }),
  pushToast: (type, text) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    set(state => ({ toasts: [...state.toasts, { id, type, text }] }))
    setTimeout(() => get().dismissToast(id), 3000)
  },
  dismissToast: (id) => {
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }))
  },

  setMemoryOn: async (on) => {
    set({ memoryOn: on })
    if (typeof localStorage !== 'undefined') localStorage.setItem(MEM_KEY, on ? '1' : '0')
    try {
      await fetch('http://localhost:3000/api/config/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: on }),
      })
    } catch (e) {
      console.warn('[memory] save to server failed:', e)
    }
  },
}))

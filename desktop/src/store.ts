import { create } from 'zustand'

export interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
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

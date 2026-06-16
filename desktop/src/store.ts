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

interface AppState {
  conversations: Conversation[]
  currentId: string | null
  files: FileEntry[]
  deskPath: string

  /** A one-shot prompt injected into ChatArea by other components (QuickAction etc.) */
  pendingPrompt: string | null

  settings: {
    workspaceRoots: string[]
    allowExternalReads: boolean
    sandbox: boolean
    theme: 'warm-paper' | 'cool-night' | 'auto'
    loaded: boolean
  }

  // Chat
  addMessage: (convId: string, msg: Message) => void
  newConversation: () => string
  setActive: (id: string) => void

  // Desk
  setFiles: (files: FileEntry[]) => void
  addFile: (file: FileEntry) => void
  removeFile: (index: number) => void
  setDeskPath: (path: string) => void

  // Cross-component triggers
  setPendingPrompt: (prompt: string | null) => void

  // Settings
  loadSettings: () => Promise<void>
  saveSettings: () => Promise<void>
  setSettings: (partial: Partial<AppState['settings']>) => void

  // Stage 1c: theme
  setTheme: (theme: AppState['settings']['theme']) => void
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }

export const useStore = create<AppState>((set, get) => ({
  conversations: [{ id: 'default', title: '新对话', messages: [], active: true }],
  currentId: 'default',
  files: [],
  deskPath: '',
  pendingPrompt: null,

  settings: {
    workspaceRoots: [],
    allowExternalReads: true,
    sandbox: true,
    theme: (typeof localStorage !== 'undefined' && (localStorage.getItem('rem.theme') as any)) || 'warm-paper',
    loaded: false,
  },

  addMessage: (convId, msg) => {
    set(state => ({
      conversations: state.conversations.map(c =>
        c.id === convId ? { ...c, messages: [...c.messages, msg] } : c
      )
    }))
  },

  newConversation: () => {
    const id = genId()
    set(state => ({
      conversations: [
        ...state.conversations.map(c => ({ ...c, active: false })),
        { id, title: '新对话', messages: [], active: true }
      ],
      currentId: id,
    }))
    return id
  },

  setActive: (id) => {
    set(state => ({
      currentId: id,
      conversations: state.conversations.map(c => ({ ...c, active: c.id === id }))
    }))
  },

  setFiles: (files) => set({ files }),
  addFile: (file) => set(state => ({ files: [...state.files, file] })),
  removeFile: (index) => set(state => ({ files: state.files.filter((_, i) => i !== index) })),
  setDeskPath: (deskPath) => set({ deskPath }),

  setPendingPrompt: (pendingPrompt) => set({ pendingPrompt }),

  loadSettings: async () => {
    try {
      const res = await fetch('http://localhost:3000/api/config/security')
      const data = await res.json()
      set({
        settings: {
          workspaceRoots: data.workspaceRoots ?? [],
          allowExternalReads: data.allowExternalReads ?? true,
          sandbox: data.sandbox ?? true,
          loaded: true,
        }
      })
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
    // Apply immediately (don't wait for server)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('rem.theme', theme)
    }
    document.documentElement.setAttribute('data-theme', theme)
    // Persist to server (best-effort; ignore failures since localStorage already has it)
    try {
      await fetch('http://localhost:3000/api/config/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme }),
      })
    } catch (e) {
      console.warn('[theme] save to server failed (localStorage has it):', e)
    }
  },
}))

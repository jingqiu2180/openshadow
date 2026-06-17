import React, { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useStore, type FileEntry, type ModelInfo, type ThinkingLevel, type PermissionMode, type TreeNode } from '../store'
import remAvatar from '../assets/rem-avatar.png'

const TEXT_EXT = new Set(['txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'py', 'html', 'css', 'scss', 'yaml', 'yml', 'xml', 'csv', 'log', 'sh', 'bat', 'c', 'cpp', 'h', 'hpp', 'rs', 'go', 'java', 'rb', 'php'])
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'])

function classifyFile(name: string): 'text' | 'image' | 'binary' {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (TEXT_EXT.has(ext)) return 'text'
  if (IMAGE_EXT.has(ext)) return 'image'
  return 'binary'
}

const SLASH_COMMANDS: Array<{ cmd: string; desc: string; action: (ctx: SlashCtx) => string }> = [
  { cmd: '/clear', desc: '清空当前对话', action: ({ clearConv }) => { clearConv(); return '已清空当前对话' } },
  { cmd: '/new', desc: '开始新对话', action: ({ newConv }) => { newConv(); return '已创建新对话' } },
  { cmd: '/model', desc: '切换模型（用法：/model gpt-4o）', action: ({ switchModel, args }) => {
    if (!args) return '用法：/model <model-name>'
    switchModel(args)
    return `模型切换请求已发送：${args}`
  } },
  { cmd: '/help', desc: '显示可用命令', action: () =>
    SLASH_COMMANDS.map(c => `${c.cmd}  —  ${c.desc}`).join('\n')
  },
]

interface SlashCtx {
  clearConv: () => void
  newConv: () => void
  switchModel: (m: string) => void
  args: string
}

export default function ChatArea({ onToggleBrowser }: { onToggleBrowser?: () => void }) {
  const {
    conversations, currentId, addMessage, pendingPrompt, setPendingPrompt,
    settings, memoryOn, setMemoryOn, permissionMode, setPermissionMode,
    currentModel, availableModels, setCurrentModel, thinkingLevel, setThinkingLevel,
    loadModels, loadSettings, refreshTree, tree,
    setWsStatus, pushToast,
  } = useStore()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [streaming, setStreaming] = useState('')
  const [openPopover, setOpenPopover] = useState<'slash' | 'thinking' | 'model' | null>(null)
  const [slashFilter, setSlashFilter] = useState('')
  const [atFilter, setAtFilter] = useState('')
  const [atStartPos, setAtStartPos] = useState(-1)
  const [attachedFiles, setAttachedFiles] = useState<FileEntry[]>([])
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const conv = conversations.find(c => c.id === currentId) ?? conversations[0]
  const messages = conv?.messages ?? []
  const isEmpty = messages.length === 0 && !streaming

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages, streaming])

  useEffect(() => {
    loadModels()
  }, [loadModels])

  useEffect(() => {
    if (pendingPrompt) {
      const prompt = pendingPrompt
      setPendingPrompt(null)
      send(prompt)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt])

  async function send(text: string) {
    if (!text.trim() || sending || !currentId) return
    const fullText = attachedFiles.length
      ? text + '\n\n[附件]\n' + attachedFiles.map(f => `- ${f.name} (${f.path})`).join('\n')
      : text
    const userMsg = { role: 'user' as const, content: fullText, timestamp: Date.now() }
    addMessage(currentId, userMsg)
    setInput('')
    setAttachedFiles([])
    setSending(true)
    setStreaming('')
    setWsStatus('connecting')

    const ws = new WebSocket('ws://localhost:8080')
    let buffer = ''

    ws.onopen = () => {
      setWsStatus('connected')
      ws.send(JSON.stringify({
        type: 'chat',
        content: fullText,
        stream: true,
        model: currentModel,
        thinkingLevel,
        permissionMode,
        memoryOn,
      }))
    }

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'delta' && typeof data.delta === 'string') {
          buffer += data.delta
          setStreaming(buffer)
        } else if (data.type === 'done' || data.type === 'response') {
          addMessage(currentId, {
            role: 'assistant',
            content: buffer || data.content || '（无响应）',
            timestamp: Date.now(),
          })
          buffer = ''
          setStreaming('')
          setSending(false)
          ws.close()
        } else if (data.type === 'error') {
          addMessage(currentId, {
            role: 'assistant',
            content: '错误: ' + (data.content || '未知错误'),
            timestamp: Date.now(),
          })
          buffer = ''
          setStreaming('')
          setSending(false)
          ws.close()
        }
      } catch {
        addMessage(currentId, { role: 'assistant', content: '消息解析错误', timestamp: Date.now() })
        setStreaming('')
        setSending(false)
        ws.close()
      }
    }

    ws.onerror = () => {
      setWsStatus('error')
      addMessage(currentId, { role: 'assistant', content: '连接失败，请确保服务已启动', timestamp: Date.now() })
      setStreaming('')
      setSending(false)
      pushToast('error', 'WebSocket 连接失败')
    }

    ws.onclose = () => {
      setWsStatus('disconnected')
    }
  }

  // ─── Slash command handler ─────────────────────────────────
  const runSlash = useCallback((cmdLine: string) => {
    const [cmd, ...rest] = cmdLine.split(/\s+/)
    const args = rest.join(' ').trim()
    const found = SLASH_COMMANDS.find(c => c.cmd === cmd)
    if (!found) {
      addMessage(currentId!, {
        role: 'assistant',
        content: `未知命令：${cmd}\n输入 /help 查看可用命令`,
        timestamp: Date.now(),
      })
      return
    }
    const ctx: SlashCtx = {
      clearConv: () => {
        const c = conversations.find(c => c.id === currentId)
        if (c) {
          // 直接清空消息通过 store
          useStore.setState(state => ({
            conversations: state.conversations.map(cc =>
              cc.id === currentId ? { ...cc, messages: [], updatedAt: Date.now() } : cc
            )
          }))
        }
      },
      newConv: () => useStore.getState().newConversation(),
      switchModel: (m) => {
        const found = availableModels.find(am => am.model === m || am.label === m)
        if (found) setCurrentModel(found)
        else {
          // 尝试用 provider::model 格式
          const [provider, model] = m.split('::')
          if (provider && model) setCurrentModel({ provider, model })
        }
      },
      args,
    }
    const result = found.action(ctx)
    if (result) {
      addMessage(currentId!, { role: 'assistant', content: result, timestamp: Date.now() })
    }
  }, [addMessage, availableModels, conversations, currentId, setCurrentModel])

  // 拦截发送：如果以 / 开头则当 slash 命令
  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text) return
    if (text.startsWith('/')) {
      runSlash(text)
      setInput('')
      return
    }
    send(text)
  }, [input, runSlash])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ─── File attach ───────────────────────────────────────────
  const handleAttach = useCallback((files: FileList | File[] | null) => {
    if (!files) return
    const list = Array.from(files)
    if (list.length === 0) return
    const arr: FileEntry[] = []
    let pending = list.length
    list.forEach((file) => {
      const kind = classifyFile(file.name)
      const entry: FileEntry = {
        name: file.name,
        path: (file as any).path ?? file.name,
        isDirectory: false,
        size: file.size,
        modified: new Date(file.lastModified).toISOString(),
        kind,
      }
      const finalize = () => {
        arr.push(entry)
        pending--
        if (pending === 0) {
          setAttachedFiles(prev => [...prev, ...arr])
          useStore.getState().addFiles(arr)
        }
      }
      if (kind === 'text' && file.size < 64 * 1024) {
        file.text().then(t => { entry.preview = t; finalize() })
      } else if (kind === 'image') {
        const r = new FileReader()
        r.onload = () => { entry.preview = r.result as string; finalize() }
        r.readAsDataURL(file)
      } else {
        finalize()
      }
    })
  }, [])

  // ─── Paste (Ctrl+V) image ───────────────────────────────────
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    const files: File[] = []
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const f = items[i].getAsFile()
        if (f) files.push(f)
      }
    }
    if (files.length > 0) {
      e.preventDefault()
      handleAttach(files)
    }
  }, [handleAttach])

  const renderBubble = (role: 'user' | 'assistant', content: string, key: React.Key) => {
    const isUser = role === 'user'
    return (
      <div
        key={key}
        style={{
          display: 'flex',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          marginBottom: 16,
        }}
      >
        {!isUser && (
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'linear-gradient(135deg, #d4b896, #a88860)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 13, fontWeight: 600, marginRight: 10, flexShrink: 0,
          }}>R</div>
        )}
        <div
          className={isUser ? '' : 'md-bubble'}
          style={{
            maxWidth: '80%',
            padding: '10px 14px',
            borderRadius: 14,
            fontSize: 14,
            lineHeight: 1.6,
            whiteSpace: isUser ? 'pre-wrap' : 'normal',
            ...(isUser ? {
              background: '#667eea',
              color: 'white',
              borderBottomRightRadius: 4,
            } : {
              background: 'white',
              color: '#333',
              borderBottomLeftRadius: 4,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }),
          }}
        >
          {isUser ? content : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#faf8f5',
    }}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => handleAttach(e.target.files)}
      />
      <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {isEmpty ? (
          <WelcomePanel
            workspaceRoots={settings.workspaceRoots}
            memoryOn={memoryOn}
            onToggleMemory={() => setMemoryOn(!memoryOn)}
            onRefresh={async () => { await loadSettings(); await refreshTree() }}
          />
        ) : (
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            {messages.map((msg, i) => renderBubble(msg.role, msg.content, i))}
            {streaming && renderBubble('assistant', streaming, 'streaming')}
            {!streaming && sending && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ccc', animation: 'blink 1s infinite' }} />
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ccc', animation: 'blink 1s infinite 0.3s' }} />
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ccc', animation: 'blink 1s infinite 0.6s' }} />
              </div>
            )}
          </div>
        )}
      </div>

      <div
        style={{ padding: '12px 24px 20px' }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault()
            setIsDraggingOver(true)
          }
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setIsDraggingOver(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setIsDraggingOver(false)
          if (e.dataTransfer.files?.length) {
            handleAttach(e.dataTransfer.files)
          }
        }}
      >
        <div style={{
          maxWidth: 700, margin: '0 auto', position: 'relative',
          outline: isDraggingOver ? '2px dashed #667eea' : 'none',
          outlineOffset: 4, borderRadius: 16,
          transition: 'outline 0.15s',
        }}>
          <InputCard
            value={input}
            onChange={(v) => {
              setInput(v)
              setSlashFilter(v.startsWith('/') ? v.slice(1).toLowerCase() : '')
              const atIdx = v.lastIndexOf('@')
              if (atIdx >= 0 && (atIdx === 0 || /\s/.test(v[atIdx - 1]))) {
                const after = v.slice(atIdx + 1)
                if (/^\S*$/.test(after)) {
                  setAtFilter(after.toLowerCase())
                  setAtStartPos(atIdx)
                } else {
                  setAtFilter('')
                  setAtStartPos(-1)
                }
              } else {
                setAtFilter('')
                setAtStartPos(-1)
              }
            }}
            onKeyDown={handleKeyDown}
            onSend={handleSend}
            onPaste={handlePaste}
            sending={sending}
            permissionMode={permissionMode}
            onTogglePermission={() => setPermissionMode(permissionMode === 'ask' ? 'auto' : 'ask')}
            onToggleBrowser={onToggleBrowser}
            openPopover={openPopover}
            setOpenPopover={setOpenPopover}
            slashFilter={slashFilter}
            runSlash={runSlash}
            atFilter={atFilter}
            atStartPos={atStartPos}
            onInsertAtMention={(filePath) => {
              const name = filePath.split(/[\\/]/).pop() || filePath
              const before = input.slice(0, atStartPos)
              const after = input.slice(atStartPos).replace(/@\S*/, `@${name} `)
              setInput(before + after)
              setAtFilter('')
              setAtStartPos(-1)
            }}
            onCloseAtMention={() => { setAtFilter(''); setAtStartPos(-1) }}
            currentModel={currentModel}
            availableModels={availableModels}
            setCurrentModel={setCurrentModel}
            thinkingLevel={thinkingLevel}
            setThinkingLevel={setThinkingLevel}
            onAttach={() => fileInputRef.current?.click()}
            attachedFiles={attachedFiles}
            onRemoveAttached={(i) => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))}
            tree={tree}
          />
          {isDraggingOver && (
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#667eea', fontSize: 14, fontWeight: 500,
            }}>
              松开鼠标添加文件
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Welcome Panel ─────────────────────────────────────────────
function WelcomePanel({
  workspaceRoots, memoryOn, onToggleMemory, onRefresh,
}: {
  workspaceRoots: string[]
  memoryOn: boolean
  onToggleMemory: () => void
  onRefresh: () => void
}) {
  const primaryWorkspace = workspaceRoots[0] || 'D:\\src\\aicoding\\remu'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', paddingTop: 80, gap: 18,
    }}>
      <RemAvatar />
      <p style={{
        fontSize: 19, color: '#5a5a5a', fontWeight: 300,
        letterSpacing: '0.02em', margin: 0,
      }}>
        要做什么, 交给 Rem 吧
      </p>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 13, color: '#888',
      }}>
        <FolderIcon />
        <span>工作台: {primaryWorkspace}</span>
        <button
          onClick={onRefresh}
          title="刷新工作区"
          style={{
            background: 'none', border: 'none', padding: 2,
            cursor: 'pointer', color: '#888',
            display: 'flex', alignItems: 'center',
          }}
        >
          <RefreshIcon />
        </button>
      </div>

      <button
        onClick={onToggleMemory}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 13, color: memoryOn ? '#5a5a5a' : '#aaa',
          background: 'none', border: 'none',
          padding: '4px 10px', cursor: 'pointer',
          fontWeight: memoryOn ? 500 : 400,
        }}
      >
        <DiamondIcon active={memoryOn} />
        <span>{memoryOn ? '记忆' : '记忆 (关)'}</span>
      </button>
    </div>
  )
}

// ─── Rem Avatar ───────────────────────────────────────────────
function RemAvatar() {
  return (
    <div style={{
      width: 108, height: 108, position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <img
        src={remAvatar} alt="Rem"
        style={{
          width: 100, height: 100, borderRadius: '50%',
          objectFit: 'cover',
          boxShadow: '0 8px 24px rgba(58, 104, 144, 0.25), inset 0 0 0 2px rgba(255, 255, 255, 0.4)',
          position: 'relative', zIndex: 1,
        }}
      />
      <div style={{
        position: 'absolute', width: 110, height: 110, borderRadius: '50%',
        border: '1px dashed rgba(58, 104, 144, 0.3)', pointerEvents: 'none',
      }} />
      <Sakura style={{ position: 'absolute', top: -4, right: 4 }} size={22} rotate={15} />
      <Sakura style={{ position: 'absolute', top: 14, left: -10 }} size={16} rotate={-30} />
      <Sakura style={{ position: 'absolute', bottom: 2, right: -8 }} size={18} rotate={45} />
      <Sakura style={{ position: 'absolute', bottom: 20, left: 2 }} size={12} rotate={-15} />
      <Sakura style={{ position: 'absolute', top: '42%', right: -12 }} size={14} rotate={60} />
      <Sakura style={{ position: 'absolute', top: '12%', left: -2 }} size={10} rotate={-50} />
    </div>
  )
}

function Sakura({ style, size = 16, rotate = 0 }: {
  style?: React.CSSProperties; size?: number; rotate?: number
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <g transform={`rotate(${rotate} 12 12)`}>
        {[0, 72, 144, 216, 288].map((angle, i) => (
          <ellipse key={i} cx="12" cy="7" rx="3" ry="4.5"
            fill="#f4c0cc"
            transform={`rotate(${angle} 12 12)`} opacity="0.92" />
        ))}
        <circle cx="12" cy="12" r="1.8" fill="#e8a4b8" />
        <circle cx="12" cy="12" r="0.8" fill="#fff5e0" />
      </g>
    </svg>
  )
}

// ─── Input Card ───────────────────────────────────────────────
function InputCard(props: {
  value: string
  onChange: (v: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onSend: () => void
  onPaste?: (e: React.ClipboardEvent) => void
  sending: boolean
  permissionMode: PermissionMode
  onTogglePermission: () => void
  onToggleBrowser?: () => void
  openPopover: 'slash' | 'thinking' | 'model' | null
  setOpenPopover: (p: 'slash' | 'thinking' | 'model' | null) => void
  slashFilter: string
  runSlash: (cmd: string) => void
  atFilter: string
  atStartPos: number
  onInsertAtMention: (filePath: string) => void
  onCloseAtMention: () => void
  currentModel: ModelInfo
  availableModels: ModelInfo[]
  setCurrentModel: (m: ModelInfo) => Promise<void>
  thinkingLevel: ThinkingLevel
  setThinkingLevel: (l: ThinkingLevel) => void
  onAttach: () => void
  attachedFiles: FileEntry[]
  onRemoveAttached: (i: number) => void
  tree: TreeNode[]
}) {
  const { value, onChange, onKeyDown, onSend, onPaste, sending,
    permissionMode, onTogglePermission, onToggleBrowser,
    openPopover, setOpenPopover, slashFilter, runSlash,
    atFilter, atStartPos, onInsertAtMention, onCloseAtMention,
    currentModel, availableModels, setCurrentModel, thinkingLevel, setThinkingLevel,
    onAttach, attachedFiles, onRemoveAttached, tree } = props
  const [focused, setFocused] = useState(false)
  const canSend = !sending && value.trim().length > 0
  const showSlash = openPopover === 'slash' || (value.startsWith('/') && !value.includes(' '))
  const filteredSlash = SLASH_COMMANDS.filter(c =>
    !slashFilter || c.cmd.slice(1).toLowerCase().includes(slashFilter)
  )

  // 扁平化 tree → file list for @ mention
  const allFiles = (() => {
    const out: string[] = []
    const walk = (ns: TreeNode[]) => {
      for (const n of ns) {
        if (n.isDirectory && n.children) walk(n.children)
        else if (!n.isDirectory) out.push(n.path)
      }
    }
    walk(tree)
    return out
  })()
  const filteredFiles = atFilter
    ? allFiles.filter(p => p.toLowerCase().includes(atFilter))
    : allFiles
  const showAtMention = atStartPos >= 0 && filteredFiles.length > 0

  return (
    <div
      style={{
        position: 'relative',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Slash command menu */}
      {showSlash && filteredSlash.length > 0 && (
        <Popover anchor="above" align="left">
          <SlashMenu
            commands={filteredSlash}
            onSelect={(cmd) => { runSlash(cmd); onChange(''); setOpenPopover(null) }}
          />
        </Popover>
      )}

      {/* @ file mention menu */}
      {showAtMention && (
        <Popover anchor="above" align="left">
          <FileMentionMenu
            files={filteredFiles.slice(0, 20)}
            onSelect={(p) => { onInsertAtMention(p); onCloseAtMention() }}
          />
        </Popover>
      )}

      {/* Thinking dropdown */}
      {openPopover === 'thinking' && (
        <Popover anchor="above" align="right" offset={80}>
          <ThinkingDropdown
            current={thinkingLevel}
            onChange={(l) => { setThinkingLevel(l); setOpenPopover(null) }}
          />
        </Popover>
      )}

      {/* Model dropdown */}
      {openPopover === 'model' && (
        <Popover anchor="above" align="right">
          <ModelDropdown
            current={currentModel}
            available={availableModels}
            onChange={async (m) => { await setCurrentModel(m); setOpenPopover(null) }}
          />
        </Popover>
      )}

      {/* Input card */}
      <div
        style={{
          background: 'white',
          border: `1px solid ${focused ? '#c4a890' : '#e8e4df'}`,
          borderRadius: 16,
          padding: '14px 16px',
          boxShadow: focused
            ? '0 4px 18px rgba(0, 0, 0, 0.07)'
            : '0 2px 12px rgba(0, 0, 0, 0.04)',
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
      >
        {/* Attached files chips */}
        {attachedFiles.length > 0 && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 4,
            marginBottom: 8,
          }}>
            {attachedFiles.map((f, i) => (
              <AttachedFileChip key={i} file={f} onRemove={() => onRemoveAttached(i)} />
            ))}
          </div>
        )}

        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); setTimeout(() => setOpenPopover(null), 150) }}
          placeholder="把文件直接拖进输入框, 就能附带发送（输入 / 触发命令）"
          disabled={sending}
          rows={2}
          style={{
            width: '100%', padding: 0, border: 'none', outline: 'none',
            resize: 'none', fontFamily: 'inherit', fontSize: 14,
            lineHeight: 1.6, color: '#2c2c2c', background: 'transparent',
            minHeight: 52, maxHeight: 200,
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
          <button onClick={onAttach} title="附件" style={iconBtnStyle}>+</button>
          <button
            onClick={() => setOpenPopover(openPopover === 'slash' ? null : 'slash')}
            title="命令 (/)"
            style={{
              ...iconBtnStyle,
              color: openPopover === 'slash' ? '#667eea' : '#888',
            }}
          >✦</button>
          <button
            onClick={onTogglePermission}
            title="操作前询问"
            style={{
              ...pillBtnStyle,
              color: permissionMode === 'ask' ? '#5a5a5a' : '#aaa',
              background: permissionMode === 'ask' ? '#f5f1ea' : 'transparent',
              fontWeight: permissionMode === 'ask' ? 500 : 400,
            }}
          >
            <QuestionIcon />
            <span>{permissionMode === 'ask' ? '操作前问问' : '操作前不问'}</span>
          </button>
          {onToggleBrowser && (
            <button
              onClick={onToggleBrowser}
              title="浏览器"
              style={pillBtnStyle}
            >
              <GlobeIcon />
              <span>浏览器</span>
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setOpenPopover(openPopover === 'thinking' ? null : 'thinking')}
            title={`思考深度: ${thinkingLevel}`}
            style={{
              ...iconBtnStyle,
              color: thinkingLevel !== 'off' ? '#667eea' : '#888',
            }}
          >
            <LightbulbIcon />
          </button>
          <button
            onClick={() => setOpenPopover(openPopover === 'model' ? null : 'model')}
            title="选择模型"
            style={{
              ...pillBtnStyle,
              minWidth: 110,
              justifyContent: 'space-between',
              color: '#5a5a5a',
              background: openPopover === 'model' ? '#f0ede8' : 'transparent',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentModel.label ?? currentModel.model}
            </span>
            <span style={{ fontSize: 9, opacity: 0.6 }}>▾</span>
          </button>
          <button
            onClick={onSend}
            disabled={!canSend}
            style={{
              background: canSend ? '#667eea' : '#d4cfc6',
              color: 'white', border: 'none', borderRadius: 8,
              padding: '6px 14px', fontSize: 13, fontWeight: 500,
              cursor: canSend ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: 4,
              transition: 'background 0.15s',
            }}
          >
            <span>发送</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Popover container ────────────────────────────────────────
function Popover({ children, anchor, align, offset = 0 }: {
  children: React.ReactNode
  anchor: 'above' | 'below'
  align: 'left' | 'right'
  offset?: number
}) {
  return (
    <div style={{
      position: 'absolute',
      bottom: anchor === 'above' ? 'calc(100% + 6px)' : undefined,
      top: anchor === 'below' ? 'calc(100% + 6px)' : undefined,
      [align]: offset,
      zIndex: 100,
      background: 'white',
      border: '1px solid #d4cfc6',
      borderRadius: 8,
      boxShadow: '0 4px 18px rgba(0, 0, 0, 0.12)',
      minWidth: 200,
      maxWidth: 340,
      overflow: 'hidden',
    } as React.CSSProperties}>
      {children}
    </div>
  )
}

// ─── Slash Menu ───────────────────────────────────────────────
function SlashMenu({ commands, onSelect }: {
  commands: typeof SLASH_COMMANDS
  onSelect: (cmd: string) => void
}) {
  return (
    <div style={{ padding: 4, maxHeight: 280, overflowY: 'auto' }}>
      <div style={{
        fontSize: 11, color: '#aaa', padding: '6px 10px 4px',
        letterSpacing: '0.02em',
      }}>命令</div>
      {commands.map(c => (
        <div
          key={c.cmd}
          onClick={() => onSelect(c.cmd)}
          style={{
            padding: '8px 10px', borderRadius: 6,
            cursor: 'pointer', transition: 'background 0.1s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f2ed')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#667eea' }}>{c.cmd}</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{c.desc}</div>
        </div>
      ))}
    </div>
  )
}

// ─── File Mention Menu ───────────────────────────────────────
function FileMentionMenu({ files, onSelect }: {
  files: string[]
  onSelect: (path: string) => void
}) {
  return (
    <div style={{ padding: 4, maxHeight: 280, overflowY: 'auto' }}>
      <div style={{ fontSize: 11, color: '#aaa', padding: '6px 10px 4px' }}>文件</div>
      {files.map(p => {
        const name = p.split(/[\\/]/).pop() || p
        return (
          <div
            key={p}
            onClick={() => onSelect(p)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f2ed')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ fontSize: 12 }}>📄</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
              <div style={{ fontSize: 10, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Thinking Dropdown ────────────────────────────────────────
function ThinkingDropdown({ current, onChange }: {
  current: ThinkingLevel
  onChange: (l: ThinkingLevel) => void
}) {
  const options: Array<{ value: ThinkingLevel; label: string; desc: string }> = [
    { value: 'off', label: '关闭', desc: '不思考' },
    { value: 'low', label: '低', desc: '快速响应' },
    { value: 'medium', label: '中', desc: '平衡' },
    { value: 'high', label: '高', desc: '深度推理' },
  ]
  return (
    <div style={{ padding: 4 }}>
      <div style={{ fontSize: 11, color: '#aaa', padding: '6px 10px 4px' }}>思考深度</div>
      {options.map(o => (
        <div
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
            background: current === o.value ? 'rgba(102, 126, 234, 0.08)' : 'transparent',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f2ed')}
          onMouseLeave={(e) => (e.currentTarget.style.background = current === o.value ? 'rgba(102, 126, 234, 0.08)' : 'transparent')}
        >
          <span style={{ fontSize: 13, color: '#333', minWidth: 32, fontWeight: current === o.value ? 600 : 400 }}>{o.label}</span>
          <span style={{ fontSize: 11, color: '#888' }}>{o.desc}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Model Dropdown ───────────────────────────────────────────
function ModelDropdown({ current, available, onChange }: {
  current: ModelInfo
  available: ModelInfo[]
  onChange: (m: ModelInfo) => void
}) {
  return (
    <div style={{ padding: 4, maxHeight: 320, overflowY: 'auto' }}>
      <div style={{ fontSize: 11, color: '#aaa', padding: '6px 10px 4px' }}>选择模型</div>
      {available.length === 0 && (
        <div style={{ padding: '8px 10px', fontSize: 12, color: '#aaa' }}>
          暂无可用模型
        </div>
      )}
      {available.map(m => {
        const isCurrent = m.provider === current.provider && m.model === current.model
        return (
          <div
            key={`${m.provider}::${m.model}`}
            onClick={() => onChange(m)}
            style={{
              padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
              background: isCurrent ? 'rgba(102, 126, 234, 0.08)' : 'transparent',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f2ed')}
            onMouseLeave={(e) => (e.currentTarget.style.background = isCurrent ? 'rgba(102, 126, 234, 0.08)' : 'transparent')}
          >
            <div style={{ fontSize: 13, color: '#333', fontWeight: isCurrent ? 600 : 400 }}>{m.model}</div>
            <div style={{ fontSize: 11, color: '#888' }}>{m.provider}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Attached File Chip ───────────────────────────────────────
function AttachedFileChip({ file, onRemove }: { file: FileEntry; onRemove: () => void }) {
  const isImage = file.kind === 'image' && file.preview
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 6px 2px 4px',
      background: '#f5f1ea', border: '1px solid #e8e4df',
      borderRadius: 4, fontSize: 11, color: '#5a5a5a',
    }}>
      {isImage ? (
        <img src={file.preview} style={{ width: 18, height: 18, borderRadius: 2, objectFit: 'cover' }} />
      ) : (
        <span>{file.kind === 'text' ? '📃' : '📄'}</span>
      )}
      <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
      <button
        onClick={onRemove}
        style={{
          background: 'none', border: 'none', padding: 0,
          color: '#888', cursor: 'pointer', fontSize: 13, lineHeight: 1,
        }}
      >×</button>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────
const iconBtnStyle: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 6, border: '1px solid transparent',
  background: 'transparent', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: '#888', fontSize: 16, transition: 'background 0.15s, border-color 0.15s',
}

const pillBtnStyle: React.CSSProperties = {
  height: 28, borderRadius: 6, border: '1px solid transparent',
  background: 'transparent', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '0 10px', color: '#888', fontSize: 12,
  transition: 'background 0.15s, border-color 0.15s',
}

// ─── Icons ────────────────────────────────────────────────────
function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"></polyline>
      <polyline points="1 20 1 14 7 14"></polyline>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

function DiamondIcon({ active }: { active: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 L22 12 L12 22 L2 12 Z" />
    </svg>
  )
}

function QuestionIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function LightbulbIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2v.3h6v-.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 2z" />
    </svg>
  )
}

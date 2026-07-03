import React, { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useStore, type FileEntry, type ModelInfo, type ThinkingLevel, type PermissionMode, type TreeNode, type ContentBlock } from '../store'
import PermissionModeSelect from './PermissionModeSelect'
import InputStatusBars from './InputStatusBars'
import { ContextRing } from './ContextRing'
import { MessageBlock } from './MessageBlock'
import { MessageActions } from './MessageActions'
import { CodeBlock } from './CodeBlock'
import { QuotedSelectionCard } from './QuotedSelectionCard'
import { SettingsConfirmCard } from './SettingsConfirmCard'
import { CapabilityDriftNotice } from './CapabilityDriftNotice'
import { ChatTimelineNavigator } from './ChatTimelineNavigator'
import remAvatar from '../assets/rem-avatar.png'
import styles from './ChatArea.module.css'

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

export default function ChatArea() {
  const {
    conversations, currentId, addMessage, pendingPrompt, setPendingPrompt,
    settings, memoryOn, setMemoryOn, permissionMode, setPermissionMode,
    currentModel, availableModels, setCurrentModel, thinkingLevel, setThinkingLevel,
    loadModels, loadSettings, refreshTree, tree,
    setWsStatus, pushToast, deleteMessage, updateMessage,
    quotedSelection, setQuotedSelection,
  } = useStore()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [streaming, setStreaming] = useState('')
  const [openPopover, setOpenPopover] = useState<'slash' | 'thinking' | 'model' | null>(null)
  const [editingMsgId, setEditingMsgId] = useState<number | null>(null)
  const [slashFilter, setSlashFilter] = useState('')
  const [atFilter, setAtFilter] = useState('')
  const [atStartPos, setAtStartPos] = useState(-1)
  const [attachedFiles, setAttachedFiles] = useState<FileEntry[]>([])
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)
  const messageElementsRef = useRef<Map<string, HTMLDivElement>>(new Map())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const conv = conversations.find(c => c.id === currentId) ?? conversations[0]
  const messages = conv?.messages ?? []
  const isEmpty = messages.length === 0 && !streaming

  // ─── Smart scroll: only auto-scroll when user is near bottom ───
  const userScrolledUp = useRef(false)

  useEffect(() => {
    if (!chatRef.current) return
    const el = chatRef.current

    // When user sends a message, always scroll to bottom
    const lastMsg = messages[messages.length - 1]
    if (lastMsg?.role === 'user') {
      el.scrollTop = el.scrollHeight
      userScrolledUp.current = false
      return
    }

    // When streaming, only follow if user hasn't scrolled up
    if (streaming && !userScrolledUp.current) {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      if (distFromBottom < 60) {
        el.scrollTop = el.scrollHeight
      }
    }
  }, [messages, streaming])

  // Listen for user scroll to detect manual scroll-up
  useEffect(() => {
    const el = chatRef.current
    if (!el) return
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      userScrolledUp.current = distFromBottom > 100
    }
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

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

  // 监听 chat 容器内的文本选区 — 选中后注入到 input 下方
  useEffect(() => {
    const el = chatRef.current
    if (!el) return
    const onMouseUp = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) return
      const text = sel.toString().trim()
      // 仅当选择发生在 chat 容器内
      if (!text || text.length < 4 || text.length > 2000) return
      const range = sel.getRangeAt(0)
      if (!el.contains(range.commonAncestorContainer)) return
      setQuotedSelection(text)
    }
    el.addEventListener('mouseup', onMouseUp)
    return () => el.removeEventListener('mouseup', onMouseUp)
  }, [setQuotedSelection])

  // 消息级快捷键：↑ 编辑最近一条用户消息 / Cmd+Shift+C 复制 / Cmd+R 重新生成
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const inInput = target?.tagName === 'TEXTAREA' || target?.tagName === 'INPUT' || target?.isContentEditable

      // ↑ 在空 input 中按一次，载入最后一条用户消息到 input
      if (e.key === 'ArrowUp' && inInput && target instanceof HTMLTextAreaElement) {
        if (target.value === '' && !e.shiftKey) {
          const last = [...conv.messages].reverse().find(m => m.role === 'user')
          if (last) {
            e.preventDefault()
            setInput(last.content)
          }
        }
      }

      // Cmd+Shift+C 复制最后一条 assistant 消息
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        const lastAssistant = [...conv.messages].reverse().find(m => m.role === 'assistant')
        if (lastAssistant) {
          e.preventDefault()
          void navigator.clipboard.writeText(lastAssistant.content)
          pushToast('success', '已复制最后一条回复')
        }
      }

      // Cmd+R 重新生成最后一条 assistant 消息
      if ((e.metaKey || e.ctrlKey) && (e.key === 'r' || e.key === 'R') && !e.shiftKey) {
        // 让浏览器自己的刷新继续生效，仅当非浏览器快捷键时
        if (inInput) return
        const userMsgs = conv.messages.filter(m => m.role === 'user')
        if (userMsgs.length === 0) return
        const lastUser = userMsgs[userMsgs.length - 1]
        e.preventDefault()
        send(lastUser.content)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [conv, send, pushToast, setInput])

  async function send(text: string) {
    if (!text.trim() || sending || !currentId) return
    const parts: string[] = []
    if (quotedSelection) {
      parts.push(`> ${quotedSelection.replace(/\n/g, '\n> ')}`)
    }
    if (attachedFiles.length) {
      parts.push(attachedFiles.map(f => `- ${f.name} (${f.path})`).join('\n'))
    }
    parts.push(text)
    const fullText = parts.join('\n\n')
    const userMsg = { role: 'user' as const, content: fullText, timestamp: Date.now() }
    addMessage(currentId, userMsg)
    setInput('')
    setAttachedFiles([])
    setQuotedSelection(null)
    setSending(true)
    setStreaming('')
    setWsStatus('connecting')

    // openshadow 修复：走 vite 5280 dev server，让 vite proxy 转发到 server:3000/ws
    // 原来直连 3000/api/ws（路径错、port 错）
    const ws = new WebSocket('ws://localhost:5280/api/ws')
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
        // Handle app_event format from server
        if (data.type === 'app_event') {
          if (data.event?.type === 'message_update') {
            const delta = data.event.assistantMessageEvent?.delta
            if (delta) {
              buffer += delta
              setStreaming(buffer)
            }
          } else if (data.event?.type === 'session_status' && data.event?.isStreaming === false) {
            addMessage(currentId, {
              role: 'assistant',
              content: buffer || data.event?.content || '（无响应）',
              timestamp: Date.now(),
            })
            buffer = ''
            setStreaming('')
            setSending(false)
            ws.close()
          }
        } else if (data.type === 'delta' && typeof data.delta === 'string') {
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
            content: '错误: ' + (data.message || data.content || '未知错误'),
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

  const timestampLabel = (ts: number) => {
    const d = new Date(ts)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const renderMessage = (msg: { role: 'user' | 'assistant'; content: string; timestamp?: number; blocks?: ContentBlock[] }, key: React.Key) => {
    const isUser = msg.role === 'user'
    const blocks = msg.blocks && msg.blocks.length > 0 ? msg.blocks : undefined
    const msgTs = msg.timestamp ?? Date.now()
    const isStreamingMsg = key === 'streaming' || key === 'streaming-steer'

    const editingId = editingMsgId
    const isEditing = editingId === msgTs
    const saveEdit = (newContent: string) => {
      if (!conv) return
      updateMessage(conv.id, msgTs, newContent)
      setEditingMsgId(null)
      // 重新发送
      send(newContent)
    }

    return (
      <MessageRow key={key} isUser={isUser} timestamp={msgTs} isStreaming={isStreamingMsg}
        onCopy={msg.content}
        onDelete={isStreamingMsg ? undefined : () => deleteMessage(conv?.id ?? '', msgTs)}
        onResend={isUser && !isStreamingMsg ? () => setInput(msg.content) : undefined}
        onEdit={isUser && !isStreamingMsg ? () => setEditingMsgId(msgTs) : undefined}
        messageRef={el => {
          if (el) messageElementsRef.current.set(String(msgTs), el)
          else messageElementsRef.current.delete(String(msgTs))
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
        <div style={{
          maxWidth: '80%',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          {blocks ? (
            blocks.map((block) => (
              <MessageBlock
                key={block.id}
                block={block}
                isUser={false}
                isEditing={isEditing && isUser}
                onSaveEdit={saveEdit}
                onCancelEdit={() => setEditingMsgId(null)}
              />
            ))
          ) : (
            <MessageBlock
              block={{ id: String(msgTs), type: 'text', content: msg.content }}
              isUser={isUser}
              isEditing={isEditing}
              onSaveEdit={saveEdit}
              onCancelEdit={() => setEditingMsgId(null)}
            />
          )}
        </div>
      </MessageRow>
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
      <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', position: 'relative' }}>
        <div style={{ marginBottom: 12 }}>
          <CapabilityDriftNotice />
        </div>
        <ChatTimelineNavigator
          anchors={messages
            .filter(m => m.content?.length > 0 || m.blocks?.length)
            .map(m => ({
              messageId: String(m.timestamp),
              label: m.content?.slice(0, 30) || (m.role === 'user' ? '用户消息' : 'AI 回复'),
              type: m.role,
            }))}
          scrollRef={chatRef}
          messageElementsRef={messageElementsRef}
        />
        {isEmpty ? (
          <WelcomePanel
            workspaceRoots={settings.workspaceRoots}
            memoryOn={memoryOn}
            onToggleMemory={() => setMemoryOn(!memoryOn)}
            onRefresh={async () => { await loadSettings(); await refreshTree() }}
          />
        ) : (
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            {messages.map((msg, i) => renderMessage(msg, i))}
            {streaming && (
              <div className="streaming-tail-fade">
                {renderMessage({ role: 'assistant', content: streaming }, 'streaming')}
              </div>
            )}
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
            streaming={streaming.length > 0}
            onStop={() => {
              // TODO: close WS connection when WS ref is available
              setSending(false)
              setStreaming('')
            }}
            permissionMode={permissionMode}
            onPermissionChange={setPermissionMode}
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
            onRemoveAttached={(i) => {
              if (i < 0) { setAttachedFiles([]); return }
              setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))
            }}
            tree={tree}
          />
          <QuotedSelectionCard />
          <SettingsConfirmCard />
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
  const primaryWorkspace = workspaceRoots[0] || 'D:\\src\\aicoding\\openshadow'

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
        要做什么, 交给 Shadow 吧
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

// ─── Shadow Avatar ───────────────────────────────────────────────
function RemAvatar() {
  return (
    <div style={{
      width: 108, height: 108, position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <img
        src={remAvatar} alt="Shadow"
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
  streaming: boolean
  onStop: () => void
  permissionMode: PermissionMode
  onPermissionChange: (m: PermissionMode) => void
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
  const { value, onChange, onKeyDown, onSend, onPaste, sending, streaming, onStop,
    permissionMode, onPermissionChange,
    openPopover, setOpenPopover, slashFilter, runSlash,
    atFilter, atStartPos, onInsertAtMention, onCloseAtMention,
    currentModel, availableModels, setCurrentModel, thinkingLevel, setThinkingLevel,
    onAttach, attachedFiles, onRemoveAttached, tree } = props
  const [focused, setFocused] = useState(false)
  const isStreaming = sending || streaming
  const hasInput = value.trim().length > 0
  const canSend = !sending && hasInput
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
    <div className={styles.inputRoot} onMouseDown={(e) => e.stopPropagation()}>
      {showSlash && filteredSlash.length > 0 && (
        <Popover anchor="above" align="left">
          <SlashMenu
            commands={filteredSlash}
            onSelect={(cmd) => { runSlash(cmd); onChange(''); setOpenPopover(null) }}
          />
        </Popover>
      )}

      {/* Input status bars */}
      <InputStatusBars
        slashBusyLabel={null}
        compactingLabel={null}
        inlineError={null}
        slashResult={null}
      />

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
      <div className={`${styles.inputCard}${focused ? ` ${styles.inputCardFocused}` : ''}`}>
        {/* Attached files chips — 文件附件条 (P2-6) */}
        {attachedFiles.length > 0 && (
          <div className={styles.attachedFilesRow}>
            <div className={styles.attachedFilesChips}>
              {attachedFiles.map((f, i) => (
                <AttachedFileChip key={i} file={f} onRemove={() => onRemoveAttached(i)} />
              ))}
            </div>
            <button
              type="button"
              className={styles.attachedFilesClear}
              onClick={() => onRemoveAttached(-1)}
              title="清除全部附件"
            >
              清空
            </button>
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
          className={styles.inputTextarea}
        />
        <div className={styles.controlBar}>
          <button onClick={onAttach} title="附件" className={styles.iconBtn}>+</button>
          <button
            onClick={() => setOpenPopover(openPopover === 'slash' ? null : 'slash')}
            title="命令 (/)"
            className={`${styles.iconBtn}${openPopover === 'slash' ? ` ${styles.iconBtnActive}` : ''}`}
          >✦</button>
          <PermissionModeSelect
            mode={permissionMode}
            onChange={onPermissionChange}
          />
          <ContextRing />
          <div className={styles.spacer} />
          <button
            onClick={() => setOpenPopover(openPopover === 'thinking' ? null : 'thinking')}
            title={`思考深度: ${thinkingLevel}`}
            className={`${styles.iconBtn}${thinkingLevel !== 'off' ? ` ${styles.iconBtnActive}` : ''}`}
          >
            <LightbulbIcon />
          </button>
          <button
            onClick={() => setOpenPopover(openPopover === 'model' ? null : 'model')}
            title="选择模型"
            className={`${styles.pillBtn}${openPopover === 'model' ? ` ${styles.pillBtnOpen}` : ''}`}
          >
            <span className={styles.pillBtnLabel}>
              {currentModel.label ?? currentModel.model}
            </span>
            <span className={styles.pillBtnArrow}>▾</span>
          </button>
          <button
            onClick={isStreaming ? (hasInput ? onSend : onStop) : onSend}
            disabled={!isStreaming && !hasInput}
            className={`${styles.sendBtn} ${isStreaming && !hasInput ? styles.sendBtnStop : ''} ${isStreaming && hasInput ? styles.sendBtnSteer : ''}`}
          >
            {isStreaming && !hasInput ? (
              <><StopIcon /><span>停止</span></>
            ) : isStreaming && hasInput ? (
              <><SteerIcon /><span>插话</span></>
            ) : (
              <><SendIcon /><span>发送</span></>
            )}
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
    <div
      className={`${styles.popover} ${anchor === 'above' ? styles.popoverAbove : styles.popoverBelow} ${styles[`popover${align.charAt(0).toUpperCase() + align.slice(1)}` as keyof typeof styles]}`}
      style={{ [align]: offset } as React.CSSProperties}
    >
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
    <div className={styles.dropdown}>
      <div className={styles.dropdownHeader}>命令</div>
      {commands.map(c => (
        <div
          key={c.cmd}
          onClick={() => onSelect(c.cmd)}
          className={styles.dropdownItem}
        >
          <div>
            <div className={styles.slashMenuCmd}>{c.cmd}</div>
            <div className={styles.slashMenuDesc}>{c.desc}</div>
          </div>
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
    <div className={styles.dropdown}>
      <div className={styles.dropdownHeader}>文件</div>
      {files.map(p => {
        const name = p.split(/[\\/]/).pop() || p
        return (
          <div
            key={p}
            onClick={() => onSelect(p)}
            className={styles.dropdownItem}
          >
            <span className={styles.fileMentionIcon}>📄</span>
            <div className={styles.fileMentionMain}>
              <div className={styles.fileMentionName}>{name}</div>
              <div className={styles.dropdownItemDesc}>{p}</div>
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
    <div className={styles.dropdown}>
      <div className={styles.dropdownHeader}>思考深度</div>
      {options.map(o => {
        const active = current === o.value
        return (
          <div
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`${styles.dropdownItem}${active ? ` ${styles.dropdownItemActive}` : ''}`}
          >
            <span className={`${styles.dropdownItemLabel}${active ? ` ${styles.dropdownItemLabelActive}` : ''}`}>{o.label}</span>
            <span className={styles.dropdownItemDesc}>{o.desc}</span>
          </div>
        )
      })}
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
    <div className={styles.dropdown}>
      <div className={styles.dropdownHeader}>选择模型</div>
      {available.length === 0 && (
        <div className={styles.slashMenuEmpty}>暂无可用模型</div>
      )}
      {available.map(m => {
        const isCurrent = m.provider === current.provider && m.model === current.model
        return (
          <div
            key={`${m.provider}::${m.model}`}
            onClick={() => onChange(m)}
            className={`${styles.dropdownItem}${isCurrent ? ` ${styles.dropdownItemActive}` : ''}`}
          >
            <div>
              <div className={`${styles.dropdownItemLabel}${isCurrent ? ` ${styles.dropdownItemLabelActive}` : ''}`}>{m.model}</div>
              <div className={styles.dropdownItemDesc}>{m.provider}</div>
            </div>
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
    <div className={styles.attachedChip}>
      {isImage ? (
        <img src={file.preview} className={styles.attachedChipImage} alt={file.name} />
      ) : (
        <span>{file.kind === 'text' ? '📃' : '📄'}</span>
      )}
      <span className={styles.attachedChipName}>{file.name}</span>
      <button onClick={onRemove} className={styles.attachedChipRemove}>
        ×
      </button>
    </div>
  )
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

function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 10 4 15 9 20" />
      <path d="M20 4v7a4 4 0 01-4 4H4" />
    </svg>
  )
}

function SteerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  )
}

// ─── Message Row (with hover actions + timestamp) ─────────────
function MessageRow({ isUser, timestamp, isStreaming, children, onCopy, onDelete, onResend, onEdit, messageRef }: {
  isUser: boolean
  timestamp: number
  isStreaming?: boolean
  children: React.ReactNode
  onCopy: string
  onDelete?: () => void
  onResend?: () => void
  onEdit?: () => void
  messageRef?: (el: HTMLDivElement | null) => void
}) {
  const [hovered, setHovered] = useState(false)
  const pad = (n: number) => String(n).padStart(2, '0')
  const d = new Date(timestamp)
  const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`

  return (
    <div ref={messageRef}>
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 20,
        position: 'relative',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
      <div style={{
        position: 'absolute',
        bottom: -3,
        [isUser ? 'right' : 'left']: 0,
        fontSize: 10,
        color: '#bbb',
        whiteSpace: 'nowrap',
        opacity: hovered ? 1 : 0.6,
        transition: 'opacity 0.15s',
      }}>
        {timeStr}
      </div>
      {hovered && !isStreaming && (
        <div style={{
          position: 'absolute',
          top: -2,
          [isUser ? 'left' : 'right']: 0,
          transform: isUser ? 'translateX(-100%)' : 'translateX(100%)',
          marginLeft: isUser ? 0 : 8,
          marginRight: isUser ? 8 : 0,
        }}>
          <MessageActions
            messageId={String(timestamp)}
            role={isUser ? 'user' : 'assistant'}
            content={typeof onCopy === 'string' ? onCopy : ''}
            onDelete={() => onDelete?.()}
            onResend={() => onResend?.()}
            onRegenerate={() => onResend?.()}
            onEdit={() => onEdit?.()}
          />
        </div>
      )}
    </div>
    </div>
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

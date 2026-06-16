import React, { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useStore } from '../store'

export default function ChatArea({ onToggleBrowser }: { onToggleBrowser?: () => void }) {
  const { conversations, currentId, addMessage, pendingPrompt, setPendingPrompt } = useStore()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [streaming, setStreaming] = useState('') // current streaming buffer
  const chatRef = useRef<HTMLDivElement>(null)

  const conv = conversations.find(c => c.id === currentId) ?? conversations[0]
  const messages = conv?.messages ?? []

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages, streaming])

  // Respond to cross-component triggers (DeskPanel QuickAction etc.)
  useEffect(() => {
    if (pendingPrompt) {
      const prompt = pendingPrompt
      setPendingPrompt(null) // clear before sending to avoid re-trigger on re-render
      send(prompt)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt])

  async function send(text: string) {
    if (!text.trim() || sending || !currentId) return
    const userMsg = { role: 'user' as const, content: text, timestamp: Date.now() }
    addMessage(currentId, userMsg)
    setInput('')
    setSending(true)
    setStreaming('')

    const ws = new WebSocket('ws://localhost:8080')
    let buffer = ''

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'chat', content: text, stream: true }))
    }

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'typing') {
          // server ack — no-op
        } else if (data.type === 'delta' && typeof data.delta === 'string') {
          buffer += data.delta
          setStreaming(buffer)
        } else if (data.type === 'done') {
          addMessage(currentId, {
            role: 'assistant',
            content: buffer || '（无响应）',
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
        } else if (data.type === 'response') {
          // legacy non-streaming fallback
          addMessage(currentId, {
            role: 'assistant',
            content: data.content || '（无响应）',
            timestamp: Date.now(),
          })
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
      addMessage(currentId, { role: 'assistant', content: '连接失败，请确保服务已启动', timestamp: Date.now() })
      setStreaming('')
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  // Render a message bubble. Assistant messages use Markdown; user messages plain.
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
            background: 'linear-gradient(135deg, #f093fb, #f5576c)',
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
      {/* Messages */}
      <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {messages.length === 0 && !streaming ? (
          <div style={{ textAlign: 'center', paddingTop: 40, color: '#bbb', fontSize: 14 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🌸</div>
            开始和 Rem 对话吧
          </div>
        ) : (
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            {messages.map((msg, i) => renderBubble(msg.role, msg.content, i))}
            {/* Streaming bubble (rendered live, not yet committed) */}
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

      {/* Input area */}
      <div style={{
        padding: '12px 24px 16px',
        borderTop: '1px solid #efe9e1',
        background: '#fcfbf8',
      }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          {/* Quick actions */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            {[
              { label: '截图', prompt: '请帮我截个图，看看当前屏幕上有什么' },
              { label: '看看桌面', prompt: '看看我的桌面上有什么' },
              { label: '浏览网页', prompt: '帮我打开百度' },
              { label: '搜索', prompt: '帮我搜索一下：' },
              { label: '建文件夹', prompt: '请在 D:\\src\\aicoding\\remu 下创建一个 test1 文件夹' },
            ].map(item => (
              <button
                key={item.label}
                onClick={() => send(item.prompt)}
                disabled={sending}
                style={{
                  background: '#f0ede8', border: 'none', borderRadius: 16,
                  padding: '4px 14px', fontSize: 13, color: '#666', cursor: 'pointer',
                }}
              >{item.label}</button>
            ))}
            {onToggleBrowser && (
              <button
                onClick={onToggleBrowser}
                style={{
                  background: '#e8e4f0', border: 'none', borderRadius: 16,
                  padding: '4px 14px', fontSize: 13, color: '#667eea', cursor: 'pointer',
                  fontWeight: 500,
                }}
                title="打开/关闭内置浏览器"
              >🌐 浏览器</button>
            )}
          </div>
          {/* Input */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息... (Enter 发送)"
              disabled={sending}
              rows={1}
              style={{
                flex: 1,
                padding: '10px 14px',
                border: '1px solid #e0dbd3',
                borderRadius: 20,
                fontSize: 14,
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit',
                background: 'white',
              }}
            />
            <button
              onClick={() => send(input)}
              disabled={sending || !input.trim()}
              style={{
                width: 40, height: 40, borderRadius: '50%',
                border: 'none', background: sending ? '#ccc' : '#667eea',
                color: 'white', fontSize: 18, cursor: sending ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >↑</button>
          </div>
        </div>
      </div>
    </div>
  )
}

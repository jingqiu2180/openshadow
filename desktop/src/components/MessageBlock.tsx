import React, { useState, useCallback, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ContentBlock } from '../store'
import { ChatResourceCard, FileOutputActions } from './ChatResourceCard'
import { SubagentCard } from './SubagentCard'
import styles from './ChatArea.module.css'

const bubbleBase: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 14,
  fontSize: 14,
  lineHeight: 1.6,
  borderBottomLeftRadius: 4,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
}

function ThinkingBlock({ block }: { block: ContentBlock }) {
  const [open, setOpen] = useState(false)
  const toggle = useCallback(() => setOpen(v => !v), [])
  const sealed = !block.streaming
  const startedAt = useRef<number>(Date.now())
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (sealed) return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000)
    return () => clearInterval(t)
  }, [sealed])

  return (
    <div className={styles.thinkingFoldable} data-open={open}>
      <button type="button" className={styles.thinkingSummary} onClick={toggle}>
        <span className={`${styles.thinkingArrow}${open ? ` ${styles.thinkingArrowOpen}` : ''}`}>›</span>
        {sealed ? (
          <span>思考完成 · {elapsed || Math.max(1, Math.floor((block.content?.length || 0) / 30))}s</span>
        ) : (
          <span>思考中{elapsed > 0 ? ` · ${elapsed}s` : ''}<span className={styles.thinkingDotsAnim} /></span>
        )}
      </button>
      {open && block.content && (
        <div className={styles.thinkingFoldBody}>{block.content}</div>
      )}
    </div>
  )
}

function ToolGroupBlock({ block }: { block: ContentBlock }) {
  const [collapsed, setCollapsed] = useState(false)
  const toggle = useCallback(() => setCollapsed(v => !v), [])
  const tools = block.tools || []
  if (tools.length === 0) return null
  const isSingle = tools.length === 1
  const allDone = tools.every(t => t.status === 'success' || t.status === 'error')
  const failCount = tools.filter(t => t.status === 'error').length
  const runningCount = tools.filter(t => t.status === 'running' || t.status === 'pending').length

  let summary = ''
  if (allDone) {
    summary = failCount > 0
      ? `运行了 ${tools.length} 个工具 · ${failCount} 个失败`
      : `运行了 ${tools.length} 个工具`
  } else {
    summary = runningCount > 0 ? `正在执行 · ${runningCount}` : '准备中...'
  }

  return (
    <div className={styles.toolGroupBlock}>
      {!isSingle ? (
        <button
          type="button"
          className={styles.toolGroupHeader}
          onClick={allDone ? toggle : undefined}
          data-done={allDone}
        >
          <span className={styles.toolGroupTitle}>{summary}</span>
          {allDone && (
            <span className={styles.toolGroupArrow} data-open={!collapsed}>›</span>
          )}
          {!allDone && <span className={styles.toolGroupSpinner} />}
        </button>
      ) : null}
      {(isSingle || !collapsed) && (
        <div className={styles.toolGroupContent}>
          {tools.map((tool, i) => (
            <div key={i} className={styles.toolRow} data-status={tool.status}>
              <span className={styles.toolStatusDot} data-status={tool.status} />
              <span className={styles.toolName}>{tool.name}</span>
              {tool.output && (
                <span className={styles.toolOutput}>
                  {tool.output.slice(0, 60)}{tool.output.length > 60 ? '...' : ''}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ImageBlock({ block }: { block: ContentBlock }) {
  return (
    <div className={styles.imageBlock}>
      <img src={block.content} alt="generated" className={styles.imageBlockImg} />
    </div>
  )
}

function InterludeBlock({ block }: { block: ContentBlock }) {
  const isRunning = block.streaming
  return (
    <div className={styles.interludeRow} data-status={isRunning ? 'running' : 'success'}>
      <span className={styles.interludeLine} />
      <span className={styles.interludeText}>
        {isRunning && <span className={styles.interludeSpinner} />}
        {block.content || '...'}
      </span>
      <span className={styles.interludeLine} />
    </div>
  )
}

function MoodBlockView({ block }: { block: ContentBlock }) {
  // 简单 emoji + 文字
  return (
    <div className={styles.moodBlock}>
      <span className={styles.moodEmoji}>{block.content || '🌸'}</span>
    </div>
  )
}

function SubagentBlockView({ block }: { block: ContentBlock }) {
  // block.content 包含 agent name | status | taskId | summary
  const [name, status, taskId, summary] = (block.content || '|success||').split('|')
  return (
    <SubagentCard
      taskId={taskId || 'unknown'}
      agentName={name || 'subagent'}
      status={(status as any) || 'success'}
      summary={summary}
    />
  )
}

function FileBlock({ block }: { block: ContentBlock }) {
  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(block.content || '')
  }, [block.content])
  const handleOpen = useCallback(() => {
    if (window.platform?.openFile) {
      void window.platform.openFile(block.content || '')
    } else {
      handleCopy()
    }
  }, [block.content, handleCopy])
  return (
    <ChatResourceCard
      icon={<span>📄</span>}
      title={block.content?.split(/[\\/]/).pop() || '未命名文件'}
      subtitle={block.content}
      statusLabel="文件"
      statusTone="accent"
      onClick={handleOpen}
      actionSlot={
        <FileOutputActions
          displayName={block.content || ''}
          onOpen={handleOpen}
          onCopy={handleCopy}
        />
      }
    />
  )
}

export function MessageBlock({ block, isUser, isEditing, onSaveEdit, onCancelEdit }: {
  block: ContentBlock
  isUser: boolean
  isEditing?: boolean
  onSaveEdit?: (content: string) => void
  onCancelEdit?: () => void
}) {
  const [draft, setDraft] = useState(block.content)
  useEffect(() => { setDraft(block.content) }, [block.content, isEditing])

  if (isUser) {
    if (isEditing) {
      return (
        <div className={styles.editBox}>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                onSaveEdit?.(draft)
              } else if (e.key === 'Escape') {
                onCancelEdit?.()
              }
            }}
            className={styles.editTextarea}
            autoFocus
          />
          <div className={styles.editActions}>
            <button type="button" className={styles.editCancel} onClick={onCancelEdit}>取消</button>
            <button
              type="button"
              className={styles.editSave}
              onClick={() => onSaveEdit?.(draft)}
            >
              保存并重新发送
            </button>
          </div>
        </div>
      )
    }
    return (
      <div
        className={styles.userBubble}
        style={{
          padding: '10px 14px', borderRadius: 14, fontSize: 14, lineHeight: 1.6,
          background: '#667eea', color: 'white', borderBottomRightRadius: 4,
        }}
      >
        {block.content}
      </div>
    )
  }

  switch (block.type) {
    case 'thinking':
      return <ThinkingBlock block={block} />
    case 'tool_group':
      return <ToolGroupBlock block={block} />
    case 'image':
      return <ImageBlock block={block} />
    case 'file':
      return <FileBlock block={block} />
    case 'interlude':
      return <InterludeBlock block={block} />
    case 'mood':
      return <MoodBlockView block={block} />
    case 'subagent':
      return <SubagentBlockView block={block} />
    default:
      return (
        <div style={{ ...bubbleBase, background: '#fff', color: '#333' }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.content}</ReactMarkdown>
        </div>
      )
  }
}

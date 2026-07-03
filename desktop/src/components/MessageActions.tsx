import React, { useState, useCallback } from 'react'
import { useStore } from '../store'
import styles from './ChatArea.module.css'

interface Props {
  messageId: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  onDelete?: (id: string) => void
  onResend?: (content: string) => void
  onRegenerate?: () => void
  onEdit?: () => void
}

export function MessageActions({ messageId, role, content, isStreaming, onDelete, onResend, onRegenerate, onEdit }: Props) {
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)
  const pushToast = useStore(s => s.pushToast)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      pushToast('success', '已复制')
      setTimeout(() => setCopied(false), 1500)
    })
  }, [content, pushToast])

  const handleCopyRaw = useCallback(() => {
    // 复制 markdown 原文（去掉代码块包裹）
    const raw = content
    navigator.clipboard.writeText(raw).then(() => {
      pushToast('success', '已复制原文')
    })
  }, [content, pushToast])

  const handleFeedback = useCallback((kind: 'up' | 'down') => {
    setFeedback(kind)
    pushToast('info', kind === 'up' ? '👍 已记录好评' : '👎 已记录差评')
    setTimeout(() => setFeedback(null), 2000)
    // TODO: 真实场景发送到 /api/feedback
  }, [pushToast])

  if (isStreaming) return null

  return (
    <div className={styles.msgActions}>
      {role === 'user' ? (
        <>
          <ActionBtn
            icon={<CopySmall />}
            label={copied ? '已复制' : '复制'}
            onClick={handleCopy}
          />
          <ActionBtn
            icon={<CopyRawSmall />}
            label="复制原文"
            onClick={handleCopyRaw}
          />
          <ActionBtn
            icon={<EditSmall />}
            label="编辑"
            onClick={() => onEdit?.()}
          />
          <ActionBtn
            icon={<TrashSmall />}
            label="删除"
            onClick={() => onDelete?.(messageId)}
          />
        </>
      ) : (
        <>
          <ActionBtn
            icon={<CopySmall />}
            label={copied ? '已复制' : '复制'}
            onClick={handleCopy}
          />
          <ActionBtn
            icon={<CopyRawSmall />}
            label="复制原文"
            onClick={handleCopyRaw}
          />
          <ActionBtn
            icon={<RegenSmall />}
            label="重新生成"
            onClick={() => onRegenerate?.()}
          />
          <ActionBtn
            icon={<ThumbUpSmall />}
            label="好评"
            active={feedback === 'up'}
            onClick={() => handleFeedback('up')}
          />
          <ActionBtn
            icon={<ThumbDownSmall />}
            label="差评"
            active={feedback === 'down'}
            onClick={() => handleFeedback('down')}
          />
          <ActionBtn
            icon={<TrashSmall />}
            label="删除"
            onClick={() => onDelete?.(messageId)}
          />
        </>
      )}
    </div>
  )
}

function ActionBtn({ icon, label, onClick, active }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`${styles.actionBtn}${active ? ` ${styles.actionBtnActive}` : ''}`}
    >
      {icon}
      {label}
    </button>
  )
}

function CopySmall() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  )
}

function CopyRawSmall() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
    </svg>
  )
}

function EditSmall() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function TrashSmall() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

function RegenSmall() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
      <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
    </svg>
  )
}

function ThumbUpSmall() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9A2 2 0 0 0 19.7 9H14z" />
      <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  )
}

function ThumbDownSmall() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
      <path d="M17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
    </svg>
  )
}

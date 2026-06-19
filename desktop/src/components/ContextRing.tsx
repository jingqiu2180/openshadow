// @ts-nocheck
import React, { useState, useCallback, useRef, useEffect } from 'react'
import styles from './ContextRing.module.css'

interface Props {
  tokens?: number
  contextWindow?: number
  percent?: number
  compacting?: boolean
  onCompact?: () => void
  onRefresh?: () => void
}

export function ContextRing({
  tokens = 0,
  contextWindow = 0,
  percent = 0,
  compacting = false,
  onCompact,
  onRefresh,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc as any)
    return () => document.removeEventListener('mousedown', onDoc as any)
  }, [menuOpen])

  const busy = compacting

  const handleToggle = useCallback(() => {
    if (busy) return
    setMenuOpen((o) => !o)
  }, [busy])

  const handleCompact = useCallback(() => {
    setMenuOpen(false)
    onCompact?.()
  }, [onCompact])

  const handleRefresh = useCallback(() => {
    setMenuOpen(false)
    onRefresh?.()
  }, [onRefresh])

  // SVG ring params
  const r = 6
  const sw = 2.5
  const size = (r + sw) * 2
  const center = size / 2
  const circumference = 2 * Math.PI * r
  const clampPct = Math.min(Math.max(percent, 0), 100)
  const dashoffset = circumference * (1 - clampPct / 100)

  // Token display
  const tokensK = Math.round(tokens / 1000)
  const showTokenLabel = tokens > 500

  return (
    <span className={styles.wrap}>
      <button
        ref={btnRef}
        className={`${styles.ring}${compacting ? ` ${styles.compacting}` : ''}`}
        onClick={handleToggle}
        disabled={busy}
        title={`${tokensK}K / ${Math.round(contextWindow / 1000)}K tokens (${Math.round(clampPct)}%)`}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={center} cy={center} r={r}
            fill="none" stroke="var(--ring-bg, #e8e4df)" strokeWidth={sw}
          />
          <circle
            cx={center} cy={center} r={r}
            fill="none"
            stroke={clampPct > 80 ? '#e07755' : '#667eea'}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            transform={`rotate(-90 ${center} ${center})`}
            className={styles.progress}
          />
        </svg>
        {showTokenLabel && (
          <span className={styles.label}>{tokensK}k</span>
        )}
      </button>

      {menuOpen && (
        <div className={styles.menu}>
          <button className={styles.menuItem} onClick={handleRefresh} disabled={busy}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            刷新 & 压缩
          </button>
          <button className={styles.menuItem} onClick={handleCompact} disabled={busy}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="5 9 2 12 5 15" />
              <polyline points="9 5 12 2 15 5" />
              <polyline points="15 19 12 22 9 19" />
              <polyline points="19 9 22 12 19 15" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <line x1="12" y1="2" x2="12" y2="22" />
            </svg>
            压缩上下文
          </button>
        </div>
      )}
    </span>
  )
}

// @ts-nocheck
import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { PermissionMode } from '../store'

const MODES: { mode: PermissionMode; label: string; icon: React.ReactNode }[] = [
  {
    mode: 'auto',
    label: '自动',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 18c-1.8 0-3.6-.4-5.2-1.2l-.6-.3c-1.5-.8-2.8-1.9-3.8-3.3-1-1.3-1.6-2.8-1.6-4.4V5l7-2.5L12 3l2.6.8 3.4.9 3.4.9c.4.1.6.5.6.9L19.5 7.5" />
        <circle cx="20.7" cy="17.3" r="4.1" />
        <path d="M22 16c-.3.5-.8.9-1.4 1.1-.7.3-1.5.3-2.2 0-.6-.2-1.2-.7-1.4-1.1" />
      </svg>
    ),
  },
  {
    mode: 'operate',
    label: '直接操作',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
  },
  {
    mode: 'ask',
    label: '操作前询问',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.7-2.5 2-2.5 4" />
        <path d="M12 17h.01" />
      </svg>
    ),
  },
  {
    mode: 'read_only',
    label: '只读',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 2h8l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
        <path d="M8 13h8M8 17h4" />
        <circle cx="12" cy="8" r="1" fill="currentColor" />
      </svg>
    ),
  },
]

const LABEL_MAP: Record<PermissionMode, string> = {
  auto: '自动',
  operate: '直接操作',
  ask: '操作前询问',
  read_only: '只读',
}

export default function PermissionModeSelect({
  mode,
  onChange,
  disabled = false,
}: {
  mode: PermissionMode
  onChange: (m: PermissionMode) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = MODES.find(m => m.mode === mode) ?? MODES[2] // default ask

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const select = useCallback(
    (next: PermissionMode) => {
      setOpen(false)
      if (next === mode) return
      onChange(next)
    },
    [mode, onChange],
  )

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        disabled={disabled}
        title={`权限模式: ${current.label}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          height: 30,
          padding: '0 10px',
          borderRadius: 8,
          border: '1px solid transparent',
          background: mode === 'ask' ? '#f5f1ea' : mode === 'read_only' ? '#f0f4f8' : mode === 'auto' ? '#f0f8f0' : 'transparent',
          color: mode === 'ask' ? '#5a4a3a' : mode === 'read_only' ? '#4a5a6a' : mode === 'auto' ? '#3a5a3a' : '#666',
          fontWeight: 500,
          fontSize: 12,
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
      >
        {current.icon}
        <span>{current.label}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: 0,
            minWidth: 150,
            background: '#fff',
            border: '1px solid #e5e0da',
            borderRadius: 10,
            boxShadow: '0 6px 24px rgba(0,0,0,0.1)',
            padding: 4,
            zIndex: 1000,
          }}
        >
          {MODES.map((item) => (
            <button
              key={item.mode}
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); select(item.mode) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                borderRadius: 6,
                background: item.mode === mode ? '#f5f0eb' : 'transparent',
                color: item.mode === mode ? '#333' : '#666',
                fontWeight: item.mode === mode ? 600 : 400,
                fontSize: 13,
                cursor: 'pointer',
                textAlign: 'left',
                lineHeight: 1,
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export { LABEL_MAP }

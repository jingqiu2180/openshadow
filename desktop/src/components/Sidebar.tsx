import React from 'react'
import { useStore } from '../store'
import remAvatar from '../assets/rem-avatar.png'
import type { MainView } from '../App'

const SECTIONS = [
  { key: 'social' as const, view: 'channels' as const, icon: <PlugIcon />, label: '接入社交平台' },
  { key: 'activity' as const, view: 'activity' as const, icon: <ActivityIcon />, label: '助手活动' },
  { key: 'plans' as const, view: 'tasks' as const, icon: <PlanIcon />, label: '任务计划' },
] as const

const PINNED_MOCK: Array<{ title: string; subtitle: string; icon?: string }> = []

const TODAY_MOCK: Array<{ title: string; subtitle: string }> = []

const WEEK_MOCK: Array<{ title: string; subtitle: string }> = []

export default function Sidebar({
  onNavigate,
  activeView,
}: {
  onNavigate: (view: MainView) => void
  activeView: MainView
}) {
  const {
    conversations, currentId, newConversation, setActive,
    searchQuery, setSearchQuery,
    togglePin, archiveConversation, renameConversation, deleteConversation,
  } = useStore()
  const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number; convId: string } | null>(null)
  const [renamingId, setRenamingId] = React.useState<string | null>(null)

  // 点击外部 / Esc 关闭菜单
  React.useEffect(() => {
    if (!contextMenu && !renamingId) return
    const close = () => { setContextMenu(null) }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setContextMenu(null); setRenamingId(null) }
    }
    document.addEventListener('click', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [contextMenu, renamingId])

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#f5f2ed',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 14px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RemBadge />
          <span style={{ fontSize: 15, fontWeight: 600, color: '#333' }}>Rem</span>
        </div>
        <button
          onClick={() => { newConversation(); onNavigate('chat') }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 18, color: '#888', padding: 4, lineHeight: 1,
          }}
          title="新对话"
        >+</button>
      </div>

      {/* Section: 对话 (with sub-actions) */}
      <div style={{ padding: '0 14px 6px' }}>
        <div style={{
          fontSize: 12, fontWeight: 500, color: '#666',
          marginBottom: 6, padding: '0 4px',
        }}>
          对话
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {SECTIONS.map(s => (
            <SectionItem
              key={s.key}
              icon={s.icon}
              label={s.label}
              active={activeView === s.view}
              onClick={() => onNavigate(s.view)}
            />
          ))}
        </div>
      </div>

      {/* Search chat history */}
      <div style={{ padding: '8px 14px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: '#ebe7e0', borderRadius: 6, padding: '6px 10px',
        }}>
          <SearchIcon />
          <input
            type="text"
            placeholder="搜索聊天记录"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1, border: 'none', outline: 'none',
              fontSize: 12, color: '#333', background: 'transparent',
              fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      {/* Conversations list — grouped by 置顶/今天/更早 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 8px' }}>
        {(() => {
          const q = searchQuery.trim().toLowerCase()
          const allConvs = q
            ? conversations.filter(c =>
                !c.archived && (c.title.toLowerCase().includes(q) ||
                c.messages.some(m => m.content.toLowerCase().includes(q)))
              )
            : conversations.filter(c => !c.archived)
          const pinned = allConvs.filter(c => c.pinned)
          const today = new Date(); today.setHours(0, 0, 0, 0)
          const weekAgo = today.getTime() - 7 * 86400000
          const todayConvs = allConvs.filter(c => !c.pinned && c.updatedAt && c.updatedAt >= today.getTime())
          const weekConvs = allConvs.filter(c => !c.pinned && c.updatedAt && c.updatedAt >= weekAgo && c.updatedAt < today.getTime())
          const earlierConvs = allConvs.filter(c => !c.pinned && (!c.updatedAt || c.updatedAt < weekAgo))

          if (allConvs.length === 0) {
            return (
              <div style={{
                padding: '24px 12px', textAlign: 'center',
                fontSize: 12, color: '#bbb', lineHeight: 1.6,
              }}>
                {q ? '没有匹配的对话' : '还没有对话\n点击右上角 + 开始'}
              </div>
            )
          }

          return (
            <>
              {pinned.length > 0 && (
                <Group label="置顶">
                  {pinned.map(conv => (
                    <ConvItem
                      key={conv.id}
                      conv={conv}
                      renamingId={renamingId}
                      setRenamingId={setRenamingId}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setContextMenu({ x: e.clientX, y: e.clientY, convId: conv.id })
                      }}
                    />
                  ))}
                </Group>
              )}
              {todayConvs.length > 0 && (
                <Group label="今天">
                  {todayConvs.map(conv => (
                    <ConvItem
                      key={conv.id}
                      conv={conv}
                      renamingId={renamingId}
                      setRenamingId={setRenamingId}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setContextMenu({ x: e.clientX, y: e.clientY, convId: conv.id })
                      }}
                    />
                  ))}
                </Group>
              )}
              {weekConvs.length > 0 && (
                <Group label="本周">
                  {weekConvs.map(conv => (
                    <ConvItem
                      key={conv.id}
                      conv={conv}
                      renamingId={renamingId}
                      setRenamingId={setRenamingId}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setContextMenu({ x: e.clientX, y: e.clientY, convId: conv.id })
                      }}
                    />
                  ))}
                </Group>
              )}
              {earlierConvs.length > 0 && (
                <Group label="更早">
                  {earlierConvs.map(conv => (
                    <ConvItem
                      key={conv.id}
                      conv={conv}
                      renamingId={renamingId}
                      setRenamingId={setRenamingId}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setContextMenu({ x: e.clientX, y: e.clientY, convId: conv.id })
                      }}
                    />
                  ))}
                </Group>
              )}
            </>
          )
        })()}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          conv={conversations.find(c => c.id === contextMenu.convId)!}
          onClose={() => setContextMenu(null)}
          onAction={(action) => {
            const id = contextMenu.convId
            if (action === 'rename') {
              setRenamingId(id)
            } else if (action === 'pin') {
              togglePin(id)
            } else if (action === 'archive') {
              archiveConversation(id)
              if (currentId === id) {
                const next = conversations.find(c => c.id !== id && !c.archived)
                if (next) setActive(next.id)
              }
            } else if (action === 'delete') {
              if (confirm('确定删除这个对话？此操作不可撤销。')) {
                deleteConversation(id)
              }
            }
            setContextMenu(null)
          }}
        />
      )}

      {/* Footer */}
      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid #e8e4df',
        fontSize: 11,
        color: '#bbb',
        textAlign: 'center',
      }}>
        Rem Agent v0.1.0
      </div>
    </div>
  )
}

// ─── Context Menu ──────────────────────────────────────────────
function ContextMenu({ x, y, conv, onClose, onAction }: {
  x: number; y: number
  conv: { id: string; pinned?: boolean; archived?: boolean }
  onClose: () => void
  onAction: (action: 'rename' | 'pin' | 'archive' | 'delete') => void
}) {
  // 防止菜单超出视口
  const adjustedX = Math.min(x, window.innerWidth - 180)
  const adjustedY = Math.min(y, window.innerHeight - 200)
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', top: adjustedY, left: adjustedX, zIndex: 1000,
        background: 'white', border: '1px solid #d4cfc6', borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)', padding: 4, minWidth: 160,
      }}
    >
      <MenuItem icon="✏️" label="重命名" onClick={() => onAction('rename')} />
      <MenuItem icon={conv.pinned ? '📌' : '📍'} label={conv.pinned ? '取消置顶' : '置顶'} onClick={() => onAction('pin')} />
      <MenuItem icon="📦" label={conv.archived ? '取消归档' : '归档'} onClick={() => onAction('archive')} />
      <div style={{ height: 1, background: '#e8e4df', margin: '4px 0' }} />
      <MenuItem icon="🗑️" label="删除" danger onClick={() => onAction('delete')} />
    </div>
  )
}

function MenuItem({ icon, label, onClick, danger }: {
  icon: string; label: string; onClick: () => void; danger?: boolean
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
        fontSize: 13, color: danger ? '#d44' : '#333',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = danger ? 'rgba(221,68,68,0.08)' : '#f5f2ed')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ fontSize: 12, width: 16, textAlign: 'center' }}>{icon}</span>
      <span>{label}</span>
    </div>
  )
}

// ─── Rem Badge (mini 版本，Q 版头像) ───────────────────────
function RemBadge() {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: '50%',
      overflow: 'hidden',
      border: '1.5px solid #3a6890',
      boxShadow: '0 2px 6px rgba(58, 104, 144, 0.3)',
      flexShrink: 0,
    }}>
      <img
        src={remAvatar}
        alt="Rem"
        style={{
          width: '100%', height: '100%',
          objectFit: 'cover',
          objectPosition: 'center 30%',
        }}
      />
    </div>
  )
}

// ─── Section Item (接入社交平台 / 助手活动 / 任务计划) ─────────
function SectionItem({ icon, label, active, onClick }: {
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 8px',
        borderRadius: 6,
        fontSize: 12, color: active ? '#333' : '#666',
        background: active ? 'rgba(102, 126, 234, 0.08)' : 'transparent',
        cursor: 'pointer',
        transition: 'background 0.15s, color 0.15s',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = '#ebe7e0' }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ color: active ? '#667eea' : '#888', display: 'flex' }}>{icon}</span>
      <span>{label}</span>
    </div>
  )
}

// ─── Conversation Group ────────────────────────────────────────
function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        fontSize: 11, color: '#aaa', padding: '6px 8px 4px',
        fontWeight: 500, letterSpacing: '0.02em',
      }}>
        {label}
      </div>
      <div>{children}</div>
    </div>
  )
}

// ─── Real Conversation Item ────────────────────────────────────
function ConvItem({ conv, renamingId, setRenamingId, onContextMenu }: {
  conv: { id: string; title: string; pinned?: boolean }
  renamingId: string | null
  setRenamingId: (id: string | null) => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const { currentId, setActive, renameConversation } = useStore()
  const [draft, setDraft] = React.useState(conv.title)
  const isRenaming = renamingId === conv.id
  const isActive = conv.id === currentId
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isRenaming])

  const commit = () => {
    const t = draft.trim()
    if (t && t !== conv.title) renameConversation(conv.id, t)
    setRenamingId(null)
  }

  if (isRenaming) {
    return (
      <div style={{
        padding: '4px 8px',
        background: isActive ? 'rgba(102, 126, 234, 0.08)' : 'white',
        borderRadius: 6,
        borderLeft: isActive ? '2px solid #667eea' : '2px solid transparent',
      }}>
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commit() }
            else if (e.key === 'Escape') { setRenamingId(null); setDraft(conv.title) }
          }}
          onBlur={commit}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
          style={{
            width: '100%', padding: '2px 4px',
            border: '1px solid #667eea', borderRadius: 4,
            fontSize: 12, outline: 'none', fontFamily: 'inherit',
            background: 'white',
          }}
        />
      </div>
    )
  }

  return (
    <div
      onClick={() => setActive(conv.id)}
      onContextMenu={onContextMenu}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '7px 8px',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 12,
        color: isActive ? '#333' : '#666',
        background: isActive ? 'rgba(102, 126, 234, 0.08)' : 'transparent',
        borderLeft: isActive ? '2px solid #667eea' : '2px solid transparent',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#ebe7e0' }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
      onDoubleClick={() => setRenamingId(conv.id)}
    >
      {conv.pinned && <PinIcon />}
      <span style={{
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
      }}>{conv.title || '新对话'}</span>
    </div>
  )
}

// ─── Mock Conversation Item (置顶/今天/本周) ────────────────────
function MockConvItem({ title, subtitle, pinned }: {
  title: string; subtitle: string; pinned?: boolean
}) {
  return (
    <div style={{
      padding: '6px 8px',
      borderRadius: 6,
      fontSize: 12, color: '#888',
      cursor: 'pointer',
      transition: 'background 0.15s',
    }}
    onMouseEnter={(e) => (e.currentTarget.style.background = '#ebe7e0')}
    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        {pinned && <PinIcon />}
        <span style={{
          color: '#5a5a5a',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{title}</span>
      </div>
      <div style={{
        fontSize: 10, color: '#bbb', marginTop: 2,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{subtitle}</div>
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────
function PlugIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22v-5" />
      <path d="M9 8V2" />
      <path d="M15 8V2" />
      <path d="M18 8v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8z" />
    </svg>
  )
}

function ActivityIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

function PlanIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L8 6H5a1 1 0 0 0-1 1v3l4 4v6l2-1 2 1v-6l4-4V7a1 1 0 0 0-1-1h-3l-4-4z" />
    </svg>
  )
}

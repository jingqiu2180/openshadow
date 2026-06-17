import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import DeskPanel from './components/DeskPanel'
import BrowserPanel from './components/BrowserPanel'
import SettingsModal from './components/SettingsModal'
import { useStore } from './store'

export type MainView = 'chat' | 'channels' | 'activity' | 'tasks'

const DESK_WIDTH_KEY = 'rem.deskWidth'

export default function App() {
  const [browserVisible, setBrowserVisible] = useState(false)
  const [tab, setTab] = useState<MainView>('chat')
  const [showSettings, setShowSettings] = useState(false)
  const [deskWidth, setDeskWidth] = useState<number>(() => {
    if (typeof localStorage === 'undefined') return 280
    const v = parseInt(localStorage.getItem(DESK_WIDTH_KEY) || '280', 10)
    return Number.isFinite(v) ? Math.max(200, Math.min(500, v)) : 280
  })
  const { wsStatus, currentModel, permissionMode, toasts, dismissToast } = useStore()

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DESK_WIDTH_KEY, String(deskWidth))
    }
  }, [deskWidth])

  // 右栏拖拽
  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = deskWidth
    let lastWidth = startWidth
    const onMove = (ev: MouseEvent) => {
      // 向左拖 = 增大右栏；向右拖 = 缩小右栏
      const delta = startX - ev.clientX
      lastWidth = Math.max(200, Math.min(500, startWidth + delta))
      setDeskWidth(lastWidth)
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(DESK_WIDTH_KEY, String(lastWidth))
      }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#faf8f5',
      color: '#2c2c2c',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      position: 'relative',
    }}>
      {/* Top bar — Electron 默认窗口控制 + tabs 居中 */}
      <div style={{
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 12px',
        background: '#f5f2ed',
        borderBottom: '1px solid #e8e4df',
        flexShrink: 0,
        userSelect: 'none',
        position: 'relative',
      }}>
        {/* Tabs (居中) */}
        <div style={{
          display: 'flex', gap: 4,
          background: '#ebe7e0', borderRadius: 8, padding: 2,
        }}>
          <TabButton active={tab === 'chat'} onClick={() => setTab('chat')}>聊天</TabButton>
          <TabButton active={tab === 'channels'} onClick={() => setTab('channels')}>频道</TabButton>
        </div>

        {/* Right: settings */}
        <button
          title="设置"
          onClick={() => setShowSettings(true)}
          style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 14, color: '#888', padding: 4,
          }}
        >⚙</button>
      </div>

      {/* Main content: 3 columns */}
      <div style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
      }}>
        <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid #e8e4df' }}>
          <Sidebar onNavigate={setTab} activeView={tab} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {tab === 'chat' && <ChatArea onToggleBrowser={() => setBrowserVisible(v => !v)} />}
          {tab === 'channels' && <ChannelsPlaceholder />}
          {tab === 'activity' && <ActivityPlaceholder />}
          {tab === 'tasks' && <TasksPlaceholder />}
        </div>
        {/* 拖拽手柄 */}
        <div
          onMouseDown={startDrag}
          title="拖动调整右栏宽度"
          style={{
            width: 4, flexShrink: 0, cursor: 'col-resize',
            background: 'transparent',
            borderLeft: '1px solid #e8e4df',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(102, 126, 234, 0.15)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        />
        <div style={{ width: deskWidth, flexShrink: 0, background: '#f5f2ed' }}>
          <DeskPanel />
        </div>
      </div>

      <BrowserPanel visible={browserVisible} onClose={() => setBrowserVisible(false)} />
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {/* StatusBar (右下角) */}
      <StatusBar wsStatus={wsStatus} model={currentModel} permissionMode={permissionMode} />

      {/* ToastContainer (右上角) */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

// ─── Tab Button ───────────────────────────────────────────────
function TabButton({ active, onClick, children }: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? 'white' : 'transparent',
        border: 'none',
        borderRadius: 6,
        padding: '3px 14px',
        fontSize: 12,
        color: active ? '#333' : '#888',
        fontWeight: active ? 500 : 400,
        cursor: 'pointer',
        transition: 'background 0.15s, color 0.15s',
        boxShadow: active ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
      }}
    >
      {children}
    </button>
  )
}

// ─── Placeholder views (P0.4 + P0.7) ──────────────────────────
function ChannelsPlaceholder() {
  return (
    <PlaceholderView
      icon="📡"
      title="频道"
      desc="接入社交平台（飞书 / Telegram / 微信 / QQ）后,消息会同步到对应频道。当前未接入任何平台。"
      actionLabel="接入平台"
    />
  )
}

function ActivityPlaceholder() {
  return (
    <PlaceholderView
      icon="📊"
      title="助手活动"
      desc="这里会显示 Rem 最近的任务执行记录、文件操作、命令调用等。当前还没有任何活动记录。"
      actionLabel="查看日志"
    />
  )
}

function TasksPlaceholder() {
  return (
    <PlaceholderView
      icon="📋"
      title="任务计划"
      desc="定时任务 / 一次性提醒 / 工作流编排都会出现在这里。当前还没有创建任何计划任务。"
      actionLabel="新建计划"
    />
  )
}

function PlaceholderView({ icon, title, desc, actionLabel }: {
  icon: string
  title: string
  desc: string
  actionLabel: string
}) {
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
      color: '#888',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.5 }}>{icon}</div>
      <h2 style={{ fontSize: 18, color: '#5a5a5a', fontWeight: 500, margin: 0, marginBottom: 8 }}>{title}</h2>
      <p style={{ fontSize: 13, color: '#999', maxWidth: 360, lineHeight: 1.6, margin: 0, marginBottom: 20 }}>{desc}</p>
      <button
        onClick={() => alert(`${title} - 该功能开发中,后续版本提供`)}
        style={{
          background: 'transparent', border: '1px solid #d4cfc6',
          borderRadius: 6, padding: '6px 14px',
          fontSize: 12, color: '#666', cursor: 'pointer',
        }}
      >{actionLabel}</button>
    </div>
  )
}

// ─── StatusBar (Stage 1l Phase 3.1) ─────────────────────────
function StatusBar({ wsStatus, model, permissionMode }: {
  wsStatus: 'connected' | 'connecting' | 'disconnected' | 'error'
  model: { provider: string; model: string }
  permissionMode: string
}) {
  const statusColor =
    wsStatus === 'connected' ? '#4caf50' :
    wsStatus === 'connecting' ? '#ff9800' :
    wsStatus === 'error' ? '#f44336' : '#999'
  const statusLabel =
    wsStatus === 'connected' ? '● 已连接' :
    wsStatus === 'connecting' ? '● 连接中' :
    wsStatus === 'error' ? '● 错误' : '● 未连接'
  const permLabel =
    permissionMode === 'auto' ? '自动' :
    permissionMode === 'ask' ? '操作前询问' :
    permissionMode === 'read_only' ? '只读' :
    permissionMode === 'operate' ? '全权' : permissionMode
  return (
    <div style={{
      position: 'fixed', bottom: 6, right: 12, zIndex: 50,
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '4px 10px',
      background: 'rgba(255, 255, 255, 0.85)',
      backdropFilter: 'blur(8px)',
      border: '1px solid #e8e4df', borderRadius: 20,
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      fontSize: 11, color: '#666', userSelect: 'none',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }} />
        <span>{statusLabel}</span>
      </span>
      <span style={{ width: 1, height: 12, background: '#e8e4df' }} />
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>🧠</span>
        <span>{model.model}</span>
      </span>
      <span style={{ width: 1, height: 12, background: '#e8e4df' }} />
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>🛡</span>
        <span>{permLabel}</span>
      </span>
    </div>
  )
}

// ─── ToastContainer (Stage 1l Phase 3.2) ─────────────────────
function ToastContainer({ toasts, onDismiss }: {
  toasts: Array<{ id: string; type: 'success' | 'error' | 'info'; text: string }>
  onDismiss: (id: string) => void
}) {
  if (toasts.length === 0) return null
  const colors = {
    success: { bg: '#4caf50', icon: '✓' },
    error: { bg: '#f44336', icon: '✕' },
    info: { bg: '#667eea', icon: 'ℹ' },
  }
  return (
    <div style={{
      position: 'fixed', top: 50, right: 12, zIndex: 1100,
      display: 'flex', flexDirection: 'column', gap: 6,
      maxWidth: 360,
    }}>
      {toasts.map(t => {
        const c = colors[t.type]
        return (
          <div
            key={t.id}
            onClick={() => onDismiss(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px',
              background: 'white',
              borderLeft: `3px solid ${c.bg}`,
              borderRadius: 6,
              boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
              fontSize: 13, color: '#333', cursor: 'pointer',
              animation: 'toastSlideIn 0.2s ease-out',
            }}
          >
            <span style={{ color: c.bg, fontWeight: 600 }}>{c.icon}</span>
            <span style={{ flex: 1 }}>{t.text}</span>
            <span style={{ color: '#aaa', fontSize: 11 }}>×</span>
          </div>
        )
      })}
    </div>
  )
}

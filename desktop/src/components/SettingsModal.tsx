import React, { useState, useEffect } from 'react'
import { useStore } from '../store'

interface Props { onClose: () => void }

export default function SettingsModal({ onClose }: Props) {
  const { settings, loadSettings, saveSettings, setSettings, setTheme } = useStore()
  const [newPath, setNewPath] = useState('')
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => { loadSettings() }, [])

  const addWorkspace = () => {
    if (!newPath.trim()) return
    setSettings({ workspaceRoots: [...settings.workspaceRoots, newPath.trim()] })
    setNewPath('')
  }

  const removeWorkspace = (path: string) => {
    setSettings({ workspaceRoots: settings.workspaceRoots.filter(p => p !== path) })
  }

  const handleSave = async () => {
    await saveSettings()
    setSaveMsg('已保存')
    setTimeout(() => setSaveMsg(''), 2000)
  }

  // Stage 1c: theme options
  const themeOptions: Array<{ id: 'warm-paper' | 'cool-night' | 'auto'; name: string; preview: string }> = [
    { id: 'warm-paper', name: '暖纸', preview: 'linear-gradient(135deg, #faf8f5 0%, #e8a0b8 100%)' },
    { id: 'cool-night', name: '青夜', preview: 'linear-gradient(135deg, #1a1d24 0%, #7da3ff 100%)' },
    { id: 'auto',       name: '自动', preview: 'linear-gradient(135deg, #faf8f5 50%, #1a1d24 50%)' },
  ]

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        background: 'white', borderRadius: 16, width: 480, maxHeight: '80vh',
        overflow: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>安全设置</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888' }}>×</button>
        </div>

        {/* Workspace roots */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: '#999', marginBottom: 8 }}>工作区目录（读/写/删 全权限）</div>
          {settings.workspaceRoots.map((p, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 10px', background: '#f5f2ed', borderRadius: 6, marginBottom: 4,
              fontSize: 13,
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p}</span>
              <button
                onClick={() => removeWorkspace(p)}
                style={{ background: 'none', border: 'none', color: '#f5576c', cursor: 'pointer', fontSize: 16 }}
              >×</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              value={newPath}
              onChange={e => setNewPath(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addWorkspace()}
              placeholder="输入目录路径..."
              style={{
                flex: 1, padding: '6px 10px', border: '1px solid #e0dbd3',
                borderRadius: 6, fontSize: 13, outline: 'none',
              }}
            />
            <button
              onClick={addWorkspace}
              style={{
                padding: '6px 14px', background: '#667eea', color: 'white',
                border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer',
              }}
            >添加</button>
          </div>
        </div>

        {/* Toggles */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
            <span style={{ fontSize: 14, color: '#333' }}>允许读取工作区外文件</span>
            <Toggle value={settings.allowExternalReads} onChange={v => setSettings({ allowExternalReads: v })} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
            <span style={{ fontSize: 14, color: '#333' }}>启用沙箱隔离</span>
            <Toggle value={settings.sandbox} onChange={v => setSettings({ sandbox: v })} />
          </div>
        </div>

        {/* Stage 1c: Theme selector */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: '#999', marginBottom: 10 }}>主题 (Stage 1c)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {themeOptions.map(opt => (
              <button
                key={opt.id}
                onClick={() => setTheme(opt.id)}
                style={{
                  padding: 0,
                  border: settings.theme === opt.id ? '2px solid #667eea' : '2px solid #e0dbd3',
                  borderRadius: 10,
                  background: 'transparent',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  fontFamily: 'inherit',
                }}
              >
                <div style={{ height: 36, background: opt.preview }} />
                <div style={{ padding: '6px 0', fontSize: 12, color: '#333' }}>{opt.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          style={{
            width: '100%', padding: '10px', background: '#667eea', color: 'white',
            border: 'none', borderRadius: 10, fontSize: 14, cursor: 'pointer', fontWeight: 600,
          }}
        >
          保存设置
        </button>
        {saveMsg && (
          <div style={{ textAlign: 'center', marginTop: 8, fontSize: 13, color: '#4caf50' }}>{saveMsg}</div>
        )}
      </div>
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none',
        background: value ? '#667eea' : '#ccc',
        position: 'relative', cursor: 'pointer', outline: 'none',
      }}
    >
      <div style={{
        position: 'absolute', top: 2, left: value ? 22 : 2,
        width: 20, height: 20, borderRadius: '50%', background: 'white',
        transition: 'left 0.2s',
      }} />
    </button>
  )
}

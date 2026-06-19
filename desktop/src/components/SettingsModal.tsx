// @ts-nocheck
import React, { useState, useEffect } from 'react'
import { useStore, type ModelInfo, type ThinkingLevel, type PermissionMode } from '../store'

interface Props { onClose: () => void }

type TabId = 'general' | 'agent' | 'security' | 'providers' | 'skills' | 'mcp' | 'bridge' | 'about'

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'general', label: '通用', icon: '⚙' },
  { id: 'agent', label: '助手', icon: '🌸' },
  { id: 'security', label: '安全', icon: '🔒' },
  { id: 'providers', label: '模型', icon: '🧠' },
  { id: 'skills', label: '技能', icon: '✦' },
  { id: 'mcp', label: 'MCP', icon: '🔌' },
  { id: 'bridge', label: '桥接', icon: '🌉' },
  { id: 'about', label: '关于', icon: 'ℹ' },
]

const THINKING_OPTIONS: Array<{ value: ThinkingLevel; label: string; desc: string }> = [
  { value: 'off', label: '关闭', desc: '不思考' },
  { value: 'low', label: '低', desc: '快速响应' },
  { value: 'medium', label: '中', desc: '平衡' },
  { value: 'high', label: '高', desc: '深度推理' },
]

const PERM_OPTIONS: Array<{ value: PermissionMode; label: string; desc: string }> = [
  { value: 'auto', label: '自动', desc: '不询问,直接执行' },
  { value: 'ask', label: '询问', desc: '操作前询问' },
  { value: 'read_only', label: '只读', desc: '只读,不修改' },
  { value: 'operate', label: '全权', desc: '自动执行所有操作' },
]

const themeOptions: Array<{ id: 'warm-paper' | 'cool-night' | 'auto'; name: string; preview: string }> = [
  { id: 'warm-paper', name: '暖纸', preview: 'linear-gradient(135deg, #faf8f5 0%, #e8a0b8 100%)' },
  { id: 'cool-night', name: '青夜', preview: 'linear-gradient(135deg, #1a1d24 0%, #7da3ff 100%)' },
  { id: 'auto', name: '自动', preview: 'linear-gradient(135deg, #faf8f5 50%, #1a1d24 50%)' },
]

export default function SettingsModal({ onClose }: Props) {
  const [tab, setTab] = useState<TabId>('general')
  const {
    settings, setSettings, setTheme,
    currentModel, availableModels, setCurrentModel,
    thinkingLevel, setThinkingLevel,
    permissionMode, setPermissionMode,
    memoryOn, setMemoryOn,
    loadModels,
  } = useStore()
  const [newPath, setNewPath] = useState('')
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => { loadModels() }, [loadModels])

  const handleSave = async () => {
    await useStore.getState().saveSettings()
    setSaveMsg('已保存')
    setTimeout(() => setSaveMsg(''), 2000)
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        background: 'white', borderRadius: 16, width: 720, height: 560,
        maxHeight: '85vh', overflow: 'hidden',
        display: 'flex', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        {/* Sidebar */}
        <div style={{
          width: 160, background: '#f5f2ed', borderRight: '1px solid #e8e4df',
          padding: '16px 0', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '0 16px 16px', fontSize: 16, fontWeight: 600, color: '#333' }}>
            设置
          </div>
          <div style={{ padding: '0 12px 12px' }}>
            <input
              type="text"
              placeholder="搜索设置..."
              style={{
                width: '100%',
                padding: '6px 10px',
                border: '1px solid #d4cfc6',
                borderRadius: 6,
                fontSize: 12,
                color: '#333',
                background: 'white',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', border: 'none',
                background: tab === t.id ? 'white' : 'transparent',
                color: tab === t.id ? '#333' : '#666',
                fontSize: 13, fontWeight: tab === t.id ? 500 : 400,
                textAlign: 'left', cursor: 'pointer',
                borderLeft: tab === t.id ? '2px solid #667eea' : '2px solid transparent',
              }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 20px', borderBottom: '1px solid #e8e4df',
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
              {TABS.find(t => t.id === tab)?.label}
            </h2>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', fontSize: 20,
              cursor: 'pointer', color: '#888', lineHeight: 1,
            }}>×</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            {tab === 'general' && <GeneralTab />}
            {tab === 'agent' && (
              <AgentTab
                currentModel={currentModel}
                availableModels={availableModels}
                setCurrentModel={setCurrentModel}
                thinkingLevel={thinkingLevel}
                setThinkingLevel={setThinkingLevel}
                permissionMode={permissionMode}
                setPermissionMode={setPermissionMode}
                memoryOn={memoryOn}
                setMemoryOn={setMemoryOn}
              />
            )}
            {tab === 'security' && (
              <SecurityTab
                workspaceRoots={settings.workspaceRoots}
                newPath={newPath}
                setNewPath={setNewPath}
                allowExternalReads={settings.allowExternalReads}
                sandbox={settings.sandbox}
                setSettings={setSettings}
              />
            )}
            {tab === 'providers' && <ProvidersTab />}
            {tab === 'skills' && <SkillsTab />}
            {tab === 'mcp' && <McpTab />}
            {tab === 'bridge' && <BridgeTab />}
            {tab === 'about' && <AboutTab />}
          </div>

          <div style={{ padding: '12px 20px', borderTop: '1px solid #e8e4df', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {saveMsg && <span style={{ fontSize: 13, color: '#4caf50', alignSelf: 'center' }}>{saveMsg}</span>}
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px', background: 'transparent', border: '1px solid #d4cfc6',
                borderRadius: 8, fontSize: 13, color: '#666', cursor: 'pointer',
              }}
            >关闭</button>
            <button
              onClick={handleSave}
              style={{
                padding: '8px 16px', background: '#667eea', color: 'white',
                border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500,
              }}
            >保存</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: General ─────────────────────────────────────────────
function GeneralTab() {
  return (
    <div>
      <Section title="主题">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {themeOptions.map(opt => (
            <ThemeOption key={opt.id} opt={opt} />
          ))}
        </div>
      </Section>

      <Section title="启动">
        <Row label="开机自启" desc="登录系统时自动启动 Rem">
          <Toggle value={false} onChange={() => alert('开机自启需要在 electron-builder 配置,后续版本提供')} />
        </Row>
        <Row label="启动时最小化到托盘" desc="启动后不显示主窗口,只显示托盘图标">
          <Toggle value={false} onChange={() => alert('托盘功能后续版本提供')} />
        </Row>
      </Section>
    </div>
  )
}

function ThemeOption({ opt }: { opt: typeof themeOptions[number] }) {
  const { settings, setTheme } = useStore()
  return (
    <button
      onClick={() => setTheme(opt.id)}
      style={{
        padding: 0, border: settings.theme === opt.id ? '2px solid #667eea' : '2px solid #e0dbd3',
        borderRadius: 10, background: 'transparent',
        cursor: 'pointer', overflow: 'hidden', fontFamily: 'inherit',
      }}
    >
      <div style={{ height: 36, background: opt.preview }} />
      <div style={{ padding: '6px 0', fontSize: 12, color: '#333' }}>{opt.name}</div>
    </button>
  )
}

// ─── Tab: Agent ───────────────────────────────────────────────
function AgentTab({
  currentModel, availableModels, setCurrentModel,
  thinkingLevel, setThinkingLevel,
  permissionMode, setPermissionMode,
  memoryOn, setMemoryOn,
}: {
  currentModel: ModelInfo
  availableModels: ModelInfo[]
  setCurrentModel: (m: ModelInfo) => Promise<void>
  thinkingLevel: ThinkingLevel
  setThinkingLevel: (l: ThinkingLevel) => void
  permissionMode: PermissionMode
  setPermissionMode: (m: PermissionMode) => void
  memoryOn: boolean
  setMemoryOn: (on: boolean) => Promise<void>
}) {
  return (
    <div>
      <Section title="默认模型">
        <Select
          value={`${currentModel.provider}::${currentModel.model}`}
          onChange={(v) => {
            const [provider, model] = v.split('::')
            if (provider && model) setCurrentModel({ provider, model })
          }}
        >
          {availableModels.length === 0 && <option value="">暂无可用模型</option>}
          {availableModels.map(m => (
            <option key={`${m.provider}::${m.model}`} value={`${m.provider}::${m.model}`}>
              {m.label ?? `${m.provider} · ${m.model}`}
            </option>
          ))}
        </Select>
      </Section>

      <Section title="思考深度">
        <RadioGroup
          options={THINKING_OPTIONS.map(o => ({ value: o.value, label: o.label, desc: o.desc }))}
          value={thinkingLevel}
          onChange={setThinkingLevel}
        />
      </Section>

      <Section title="操作前询问 (Plan Mode)">
        <RadioGroup
          options={PERM_OPTIONS.map(o => ({ value: o.value, label: o.label, desc: o.desc }))}
          value={permissionMode}
          onChange={setPermissionMode}
        />
      </Section>

      <Section title="记忆">
        <Row label="开启长期记忆" desc="Rem 会记住你告诉它的重要信息 (API key 不存)">
          <Toggle value={memoryOn} onChange={setMemoryOn} />
        </Row>
      </Section>
    </div>
  )
}

// ─── Tab: Security ────────────────────────────────────────────
function SecurityTab({ workspaceRoots, newPath, setNewPath, allowExternalReads, sandbox, setSettings }: {
  workspaceRoots: string[]
  newPath: string
  setNewPath: (v: string) => void
  allowExternalReads: boolean
  sandbox: boolean
  setSettings: (p: any) => void
}) {
  return (
    <div>
      <Section title="工作区目录">
        <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
          这些目录拥有完整权限(读/写/删)
        </div>
        {workspaceRoots.map((p, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 10px', background: '#f5f2ed', borderRadius: 6, marginBottom: 4, fontSize: 13,
          }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p}</span>
            <button
              onClick={() => setSettings({ workspaceRoots: workspaceRoots.filter(x => x !== p) })}
              style={{ background: 'none', border: 'none', color: '#f5576c', cursor: 'pointer', fontSize: 16 }}
            >×</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            value={newPath}
            onChange={e => setNewPath(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && newPath.trim()) { setSettings({ workspaceRoots: [...workspaceRoots, newPath.trim()] }); setNewPath('') } }}
            placeholder="输入目录路径..."
            style={{
              flex: 1, padding: '6px 10px', border: '1px solid #e0dbd3',
              borderRadius: 6, fontSize: 13, outline: 'none',
            }}
          />
          <button
            onClick={() => { if (newPath.trim()) { setSettings({ workspaceRoots: [...workspaceRoots, newPath.trim()] }); setNewPath('') } }}
            style={{
              padding: '6px 14px', background: '#667eea', color: 'white',
              border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer',
            }}
          >添加</button>
        </div>
      </Section>

      <Section title="权限">
        <Row label="允许读取工作区外文件" desc="开启后 Rem 可以读取任意路径的文件">
          <Toggle value={allowExternalReads} onChange={v => setSettings({ allowExternalReads: v })} />
        </Row>
        <Row label="启用沙箱隔离" desc="把 Rem 的文件操作限制在工作区内">
          <Toggle value={sandbox} onChange={v => setSettings({ sandbox: v })} />
        </Row>
      </Section>
    </div>
  )
}

// ─── Tab: Providers ───────────────────────────────────────────
function ProvidersTab() {
  const { availableModels, currentModel } = useStore()
  return (
    <div>
      <Section title="已配置的模型供应商">
        <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
          模型在 config.json 的 providers 字段中配置,修改后重启 Rem 生效
        </div>
        {availableModels.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: '#aaa', fontSize: 13 }}>
            暂无可用模型。请在 config.json 配置 providers
          </div>
        ) : (
          <div>
            {Array.from(new Set(availableModels.map(m => m.provider))).map(provider => {
              const models = availableModels.filter(m => m.provider === provider)
              return (
                <div key={provider} style={{
                  padding: 10, background: '#f5f2ed', borderRadius: 8, marginBottom: 6,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{provider}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {models.map(m => {
                      const isCurrent = m.provider === currentModel.provider && m.model === currentModel.model
                      return (
                        <span key={m.model} style={{
                          fontSize: 11, padding: '2px 6px', borderRadius: 4,
                          background: isCurrent ? '#667eea' : 'white',
                          color: isCurrent ? 'white' : '#666',
                          border: '1px solid #e0dbd3',
                        }}>{m.model}</span>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Section>
    </div>
  )
}

// ─── Tab: Skills ──────────────────────────────────────────────
function SkillsTab() {
  return (
    <div>
      <Section title="技能列表">
        <Placeholder
          icon="✦"
          title="技能市场"
          desc="浏览、安装、管理 Rem 的技能。技能是从提示词模板派生的可复用工作流,后续版本提供完整市场。当前仅有内置基础技能。"
        />
      </Section>
    </div>
  )
}

// ─── Tab: MCP ─────────────────────────────────────────────────
function McpTab() {
  return (
    <div>
      <Section title="MCP 服务器">
        <Placeholder
          icon="🔌"
          title="Model Context Protocol"
          desc="MCP 让 Rem 调用外部工具。当前 core/mcp 已有 stdio + SSE 客户端实现,UI 端后续提供配置入口。"
        />
      </Section>
    </div>
  )
}

// ─── Tab: Bridge ──────────────────────────────────────────────
function BridgeTab() {
  return (
    <div>
      <Section title="社交平台桥接">
        <Placeholder
          icon="🌉"
          title="接入飞书 / Telegram / 微信 / QQ"
          desc="桥接层让 Rem 通过社交平台收发消息。当前仅占位 UI,后续版本提供 OAuth 流程和 webhook 配置。"
        />
      </Section>
    </div>
  )
}

// ─── Tab: About ───────────────────────────────────────────────
function AboutTab() {
  return (
    <div>
      <Section title="关于 Rem">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><text y='20' font-size='20'>🌸</text></svg>" style={{ width: 48, height: 48 }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Rem Agent</div>
            <div style={{ fontSize: 12, color: '#888' }}>v0.1.0 · Stage 1j</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#666', lineHeight: 1.8 }}>
          <div>从零开始异世界生活 · 雷姆</div>
          <div>Electron + TypeScript + Hono 桌面 AI Agent</div>
          <div>基于 MiniMax M-series 模型</div>
        </div>
      </Section>
    </div>
  )
}

// ─── UI helpers ───────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
      <div>
        <div style={{ fontSize: 14, color: '#333' }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{desc}</div>}
      </div>
      {children}
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
        position: 'relative', cursor: 'pointer', outline: 'none', flexShrink: 0,
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

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', padding: '8px 12px',
        border: '1px solid #e0dbd3', borderRadius: 8,
        fontSize: 13, color: '#333', background: 'white',
        fontFamily: 'inherit', outline: 'none',
      }}
    >{children}</select>
  )
}

function RadioGroup<T extends string>({ options, value, onChange }: {
  options: Array<{ value: T; label: string; desc?: string }>
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', border: '1px solid #e8e4df', borderRadius: 8,
            background: value === o.value ? 'rgba(102, 126, 234, 0.06)' : 'white',
            cursor: 'pointer', textAlign: 'left',
            borderColor: value === o.value ? '#667eea' : '#e8e4df',
          }}
        >
          <div style={{
            width: 14, height: 14, borderRadius: '50%',
            border: '2px solid ' + (value === o.value ? '#667eea' : '#d4cfc6'),
            background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {value === o.value && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#667eea' }} />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: '#333', fontWeight: value === o.value ? 500 : 400 }}>{o.label}</div>
            {o.desc && <div style={{ fontSize: 11, color: '#999' }}>{o.desc}</div>}
          </div>
        </button>
      ))}
    </div>
  )
}

function Placeholder({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{
      padding: '32px 16px', textAlign: 'center', color: '#888',
      background: '#f5f2ed', borderRadius: 8,
    }}>
      <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.6 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: '#5a5a5a', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, lineHeight: 1.6, maxWidth: 320, margin: '0 auto' }}>{desc}</div>
    </div>
  )
}

import React, { useState, useCallback, DragEvent } from 'react'
import { useStore, FileEntry } from '../store'
import SettingsModal from './SettingsModal'

const QUICK_ACTIONS: Array<{ icon: string; label: string; prompt: string }> = [
  { icon: '📸', label: '截图', prompt: '请帮我截个图，分析一下当前屏幕上有什么' },
  { icon: '🌐', label: '浏览网页', prompt: '帮我打开百度首页' },
  { icon: '🔍', label: '搜索', prompt: '帮我搜索一下：' },
  { icon: '📂', label: '打开文件夹', prompt: '请列出 D:\\src\\aicoding\\remu 目录下的文件' },
]

const TEXT_EXT = new Set(['txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'py', 'html', 'css', 'scss', 'yaml', 'yml', 'xml', 'csv', 'log', 'sh', 'bat', 'c', 'cpp', 'h', 'hpp', 'rs', 'go', 'java', 'rb', 'php'])
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'])

function classifyFile(name: string): 'text' | 'image' | 'binary' {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (TEXT_EXT.has(ext)) return 'text'
  if (IMAGE_EXT.has(ext)) return 'image'
  return 'binary'
}

export default function DeskPanel() {
  const { files, addFile, removeFile, setPendingPrompt } = useStore()
  const [showSettings, setShowSettings] = useState(false)
  const [dragging, setDragging] = useState(false)

  const handleFiles = useCallback(async (fileList: FileList) => {
    for (const file of Array.from(fileList)) {
      const kind = classifyFile(file.name)
      const entry: FileEntry = {
        name: file.name,
        path: (file as any).path ?? file.name,
        isDirectory: false,
        size: file.size,
        modified: new Date(file.lastModified).toISOString(),
        kind,
      }
      // Read small text files for inline preview; read images as data URL
      if (kind === 'text' && file.size < 64 * 1024) {
        entry.preview = await file.text()
      } else if (kind === 'image') {
        entry.preview = await new Promise<string>((resolve) => {
          const r = new FileReader()
          r.onload = () => resolve(r.result as string)
          r.readAsDataURL(file)
        })
      }
      addFile(entry)
    }
  }, [addFile])

  const onDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!dragging) setDragging(true)
  }
  const onDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
    if (e.dataTransfer?.files?.length) {
      handleFiles(e.dataTransfer.files)
    }
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#f5f2ed',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #e8e4df',
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: '#333' }}>书桌</span>
        <button
          onClick={() => setShowSettings(true)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 18, color: '#888', padding: 2,
          }}
          title="设置"
        >⚙</button>
      </div>

      {/* File list / drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          flex: 1, overflowY: 'auto', padding: '8px 0',
          outline: dragging ? '2px dashed #667eea' : 'none',
          outlineOffset: -8,
          background: dragging ? 'rgba(102,126,234,0.04)' : 'transparent',
          transition: 'background 0.15s',
        }}
      >
        {files.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#ccc', fontSize: 13 }}>
            {dragging ? '松开鼠标添加文件' : '暂无文件，拖拽到此处'}
          </div>
        ) : (
          files.map((f, i) => (
            <FileRow key={i} file={f} onRemove={() => removeFile(i)} />
          ))
        )}
      </div>

      {/* Footer actions */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid #e8e4df',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}>
        {QUICK_ACTIONS.map(a => (
          <QuickAction
            key={a.label}
            icon={a.icon}
            label={a.label}
            onClick={() => setPendingPrompt(a.prompt)}
          />
        ))}
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}

function FileRow({ file, onRemove }: { file: FileEntry; onRemove: () => void }) {
  const [open, setOpen] = useState(false)
  const isImage = file.kind === 'image' && file.preview
  const isText = file.kind === 'text' && file.preview

  return (
    <div style={{ borderBottom: '1px solid #ece8e3' }}>
      <div
        onClick={() => isImage || isText ? setOpen(o => !o) : undefined}
        style={{
          padding: '6px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          color: '#666',
          cursor: isImage || isText ? 'pointer' : 'default',
        }}
      >
        <span>{file.isDirectory ? '📁' : isImage ? '🖼️' : isText ? '📃' : '📄'}</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#bbb', display: 'flex', gap: 8, alignItems: 'center' }}>
          {formatSize(file.size)}
          <button
            onClick={(e) => { e.stopPropagation(); onRemove() }}
            style={{ background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: 14, padding: 0 }}
            title="移除"
          >×</button>
        </span>
      </div>
      {open && isImage && (
        <div style={{ padding: '6px 16px 10px' }}>
          <img src={file.preview} alt={file.name} style={{ maxWidth: '100%', borderRadius: 6 }} />
        </div>
      )}
      {open && isText && (
        <pre style={{
          margin: '0 16px 8px', padding: 8, background: '#fff', border: '1px solid #e8e4df',
          borderRadius: 6, fontSize: 11, maxHeight: 200, overflow: 'auto',
          fontFamily: 'SFMono-Regular, Consolas, monospace', color: '#444', whiteSpace: 'pre-wrap',
        }}>{file.preview}</pre>
      )}
    </div>
  )
}

function QuickAction({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px', borderRadius: 8,
        background: 'transparent', border: 'none', cursor: 'pointer',
        fontSize: 13, color: '#666', textAlign: 'left',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#ece8e3')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

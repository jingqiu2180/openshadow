import React, { useState, useCallback, useEffect, DragEvent } from 'react'
import { useStore, FileEntry, TreeNode } from '../store'
import { DeskEditor } from './DeskEditor'
import { WorkspaceCompanionRail } from './WorkspaceCompanionRail'

const TEXT_EXT = new Set(['txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'py', 'html', 'css', 'scss', 'yaml', 'yml', 'xml', 'csv', 'log', 'sh', 'bat', 'c', 'cpp', 'h', 'hpp', 'rs', 'go', 'java', 'rb', 'php'])
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'])

function classifyFile(name: string): 'text' | 'image' | 'binary' {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (TEXT_EXT.has(ext)) return 'text'
  if (IMAGE_EXT.has(ext)) return 'image'
  return 'binary'
}

function getFileKind(name: string): 'text' | 'image' | 'binary' | 'code' {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'go', 'rs', 'rb', 'php'].includes(ext)) return 'code'
  if (TEXT_EXT.has(ext)) return 'text'
  if (IMAGE_EXT.has(ext)) return 'image'
  return 'binary'
}

type Tab = 'files' | 'workspace'
type FileKindFilter = 'all' | 'code' | 'text' | 'image' | 'binary'

export default function DeskPanel() {
  const {
    files, addFile, addFiles, removeFile,
    settings, tree, refreshTree, loadSettings, deskPath,
    createFile, createFolder, renameFileNode, deleteFileNode, copyToClipboard,
    pushToast,
  } = useStore()
  const [dragging, setDragging] = useState(false)
  const [tab, setTab] = useState<Tab>('workspace')
  const [filter, setFilter] = useState<FileKindFilter>('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [fileMenu, setFileMenu] = useState<{ x: number; y: number; node: TreeNode } | null>(null)
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [creatingIn, setCreatingIn] = useState<{ parentPath: string; type: 'file' | 'folder' } | null>(null)
  const [editing, setEditing] = useState<{ path: string; content: string } | null>(null)
  const [editingLoading, setEditingLoading] = useState(false)

  // 点击外部 / Esc 关闭文件菜单
  useEffect(() => {
    if (!fileMenu && !renamingPath && !creatingIn) return
    const close = () => { setFileMenu(null) }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setFileMenu(null); setRenamingPath(null); setCreatingIn(null) }
    }
    document.addEventListener('click', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [fileMenu, renamingPath, creatingIn])

  const primaryWorkspace = settings.workspaceRoots[0] || ''
  const folderName = primaryWorkspace
    ? primaryWorkspace.split(/[\\/]/).filter(Boolean).pop() || primaryWorkspace
    : '未设置'

  // 首次挂载 + workspace 变更时刷新
  useEffect(() => {
    if (tab === 'workspace' && primaryWorkspace) {
      refreshTree()
    }
  }, [tab, primaryWorkspace, refreshTree])

  const handleFiles = useCallback(async (fileList: FileList) => {
    const arr: FileEntry[] = []
    let pending = fileList.length
    if (pending === 0) return
    Array.from(fileList).forEach((file) => {
      const kind = classifyFile(file.name)
      const entry: FileEntry = {
        name: file.name,
        path: (file as any).path ?? file.name,
        isDirectory: false,
        size: file.size,
        modified: new Date(file.lastModified).toISOString(),
        kind,
      }
      const finalize = () => {
        arr.push(entry)
        pending--
        if (pending === 0) addFiles(arr)
      }
      if (kind === 'text' && file.size < 64 * 1024) {
        file.text().then(t => { entry.preview = t; finalize() })
      } else if (kind === 'image') {
        const r = new FileReader()
        r.onload = () => { entry.preview = r.result as string; finalize() }
        r.readAsDataURL(file)
      } else {
        finalize()
      }
    })
  }, [addFiles])

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
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files)
  }

  const toggleExpand = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const expandAll = () => {
    const all = new Set<string>()
    const walk = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        if (n.isDirectory) {
          all.add(n.path)
          if (n.children) walk(n.children)
        }
      }
    }
    walk(tree)
    setExpanded(all)
  }

  const openEditor = useCallback(async (filePath: string) => {
    setEditingLoading(true)
    setEditing({ path: filePath, content: '' })
    try {
      const r = await fetch(`/api/fs/read?path=${encodeURIComponent(filePath)}`)
      const data = await r.json()
      if (data.ok) {
        setEditing({ path: filePath, content: data.content })
      } else {
        pushToast('error', `读取失败: ${data.error}`)
        setEditing(null)
      }
    } catch (e: any) {
      pushToast('error', `读取失败: ${e.message}`)
      setEditing(null)
    } finally {
      setEditingLoading(false)
    }
  }, [pushToast])

  const handleSave = useCallback(async (content: string) => {
    if (!editing) return
    try {
      const r = await fetch('/api/fs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: editing.path, content }),
      })
      const data = await r.json()
      if (data.ok) {
        pushToast('success', '已保存')
        await refreshTree()
      } else {
        pushToast('error', `保存失败: ${data.error}`)
      }
    } catch (e: any) {
      pushToast('error', `保存失败: ${e.message}`)
    }
  }, [editing, pushToast, refreshTree])

  return (
    <div
      style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        background: '#f5f2ed',
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Header */}
      <div style={{
        padding: '14px 16px 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
          <FolderIcon />
          <span style={{ fontSize: 15, fontWeight: 600, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {folderName}
          </span>
          {tab === 'workspace' && (
            <button
              onClick={() => refreshTree()}
              title="刷新"
              style={{
                background: 'none', border: 'none', padding: 2,
                cursor: 'pointer', color: '#888',
                display: 'flex', alignItems: 'center',
              }}
            >
              <RefreshIcon />
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {tab === 'workspace' && primaryWorkspace && (
            <>
              <button
                onClick={() => setCreatingIn({ parentPath: primaryWorkspace, type: 'file' })}
                title="新建文件"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#888', fontSize: 11, padding: '2px 6px', borderRadius: 4,
                  display: 'flex', alignItems: 'center', gap: 3,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#e8e4df')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              ><AddFileIcon /> 文件</button>
              <button
                onClick={() => setCreatingIn({ parentPath: primaryWorkspace, type: 'folder' })}
                title="新建文件夹"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#888', fontSize: 11, padding: '2px 6px', borderRadius: 4,
                  display: 'flex', alignItems: 'center', gap: 3,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#e8e4df')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              ><AddFolderIcon /> 文件夹</button>
            </>
          )}
          <button
            onClick={() => loadSettings()}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: '#888', padding: '2px 6px',
            }}
            title="项目技能"
          >
            <SparkleIcon />
            <span>项目技能</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', padding: '0 16px',
        borderBottom: '1px solid #e8e4df', gap: 0,
      }}>
        <TabButton active={tab === 'files'} onClick={() => setTab('files')}>对话文件</TabButton>
        <TabButton active={tab === 'workspace'} onClick={() => setTab('workspace')}>工作台</TabButton>
      </div>

      {/* Search + filter */}
      <div style={{ padding: '10px 12px 6px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'white', border: '1px solid #e8e4df',
          borderRadius: 8, padding: '6px 10px',
        }}>
          <SearchIcon />
          <input
            type="text"
            placeholder={tab === 'files' ? '搜索文件' : '搜索文件 / 文件夹'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1, border: 'none', outline: 'none',
              fontSize: 12, color: '#333', background: 'transparent',
              fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      <div style={{
        display: 'flex', gap: 4, padding: '0 12px 8px', flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        {tab === 'workspace' && (
          <button
            onClick={expandAll}
            style={{
              background: 'transparent', border: 'none',
              borderRadius: 6, padding: '3px 8px',
              fontSize: 11, color: '#888', cursor: 'pointer',
            }}
            title="展开全部"
          >展开</button>
        )}
        {([
          ['all', '全部'],
          ['code', '代码'],
          ['text', '文本'],
          ['image', '图片'],
          ['binary', '其他'],
        ] as Array<[FileKindFilter, string]>).map(([f, l]) => (
          <FilterChip
            key={f}
            active={filter === f}
            onClick={() => setFilter(f)}
            label={l}
          />
        ))}
      </div>

      {/* Content */}
      <div style={{
        flex: 1, overflowY: 'auto',
        outline: dragging ? '2px dashed #667eea' : 'none',
        outlineOffset: -8,
        background: dragging ? 'rgba(102,126,234,0.04)' : 'transparent',
        transition: 'background 0.15s',
      }}>
        {tab === 'files' ? (
          files.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#bbb', fontSize: 13 }}>
              {dragging ? '松开鼠标添加文件' : '暂无文件\n把文件拖到这里,或点击输入框的 + 按钮'}
            </div>
          ) : (
            files
              .filter(f => filter === 'all' || f.kind === filter)
              .filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()))
              .map((f, i) => (
                <FileRow key={i} file={f} onRemove={() => removeFile(i)} />
              ))
          )
        ) : (
          !primaryWorkspace ? (
            <EmptyState
              icon="📁"
              message="未设置工作区"
              hint="在设置 → 安全 中添加工作区目录"
            />
          ) : tree.length === 0 ? (
            <EmptyState
              icon="🌲"
              message="工作区为空或无法访问"
              hint="点击刷新按钮重试,或检查权限"
            />
          ) : (
            <TreeView
              nodes={tree}
              expanded={expanded}
              onToggle={toggleExpand}
              search={search.toLowerCase()}
              filter={filter}
              renamingPath={renamingPath}
              creatingIn={creatingIn}
              setRenamingPath={setRenamingPath}
              setCreatingIn={setCreatingIn}
              onContextMenu={(e, node) => setFileMenu({ x: e.clientX, y: e.clientY, node })}
              onAction={async (action, payload) => {
                if (action === 'create') {
                  if (payload.type === 'folder') await createFolder(payload.parentPath, payload.name)
                  else await createFile(payload.parentPath, payload.name)
                } else if (action === 'rename') {
                  await renameFileNode(payload.oldPath, payload.newName)
                } else if (action === 'delete') {
                  if (confirm(`确定删除 ${payload.path}？`)) await deleteFileNode(payload.path)
                } else if (action === 'copy') {
                  await copyToClipboard(payload.path)
                } else if ((action as string) === 'open') {
                  void openEditor(payload.path)
                }
              }}
            />
          )
        )}
        {/* Session status card below file tree */}
        {tab === 'workspace' && primaryWorkspace && (
          <SessionStatusCard
            workspace={primaryWorkspace}
            modelName={(settings as any).model || 'default'}
            thinkingLevel={(settings as any).thinkingLevel || 'off'}
            fileCount={tree.length}
          />
        )}
        {/* P2-15: 右侧协作栏 - 任务/活动/工作流切换 */}
        {tab === 'workspace' && (
          <div style={{ padding: '0 12px 12px' }}>
            <WorkspaceCompanionRail />
          </div>
        )}
        {/* P2-16: 内联编辑器 */}
        {editing && !editingLoading && (
          <div style={{ padding: '0 16px 12px' }}>
            <DeskEditor
              filePath={editing.path}
              content={editing.content}
              onClose={() => setEditing(null)}
              onSave={handleSave}
            />
          </div>
        )}
      </div>

      {fileMenu && (
        <FileContextMenu
          x={fileMenu.x}
          y={fileMenu.y}
          node={fileMenu.node}
          onClose={() => setFileMenu(null)}
          onAction={(action) => {
            const node = fileMenu.node
            if (action === 'newFile') {
              setCreatingIn({ parentPath: node.path, type: 'file' })
              if (!expanded.has(node.path)) {
                setExpanded(prev => new Set(prev).add(node.path))
              }
            } else if (action === 'newFolder') {
              setCreatingIn({ parentPath: node.path, type: 'folder' })
              if (!expanded.has(node.path)) {
                setExpanded(prev => new Set(prev).add(node.path))
              }
            } else if (action === 'rename') {
              setRenamingPath(node.path)
            } else if (action === 'delete') {
              if (confirm(`确定删除 ${node.path}？`)) {
                deleteFileNode(node.path)
              }
            } else if (action === 'copy') {
              copyToClipboard(node.path)
            }
            setFileMenu(null)
          }}
        />
      )}
    </div>
  )
}

// ─── Tab Button ───────────────────────────────────────────────
function TabButton({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none', border: 'none',
        padding: '8px 12px', fontSize: 13,
        color: active ? '#333' : '#999',
        fontWeight: active ? 500 : 400,
        borderBottom: active ? '2px solid #667eea' : '2px solid transparent',
        cursor: 'pointer',
      }}
    >{children}</button>
  )
}

function FilterChip({ active, onClick, label }: {
  active: boolean; onClick: () => void; label: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? '#f0ede8' : 'transparent',
        border: 'none', borderRadius: 6,
        padding: '3px 8px', fontSize: 11,
        color: active ? '#5a5a5a' : '#aaa',
        cursor: 'pointer',
      }}
    >{label}</button>
  )
}

function EmptyState({ icon, message, hint }: { icon: string; message: string; hint?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#bbb', fontSize: 13 }}>
      <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.5 }}>{icon}</div>
      <div style={{ color: '#888' }}>{message}</div>
      {hint && <div style={{ fontSize: 11, marginTop: 4, color: '#bbb' }}>{hint}</div>}
    </div>
  )
}

// ─── File Tree View ───────────────────────────────────────────
function TreeView({ nodes, expanded, onToggle, search, filter,
  renamingPath, creatingIn, setRenamingPath, setCreatingIn,
  onContextMenu, onAction }: {
  nodes: TreeNode[]
  expanded: Set<string>
  onToggle: (path: string) => void
  search: string
  filter: FileKindFilter
  renamingPath: string | null
  creatingIn: { parentPath: string; type: 'file' | 'folder' } | null
  setRenamingPath: (p: string | null) => void
  setCreatingIn: (c: { parentPath: string; type: 'file' | 'folder' } | null) => void
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void
  onAction: (action: 'create' | 'rename' | 'delete' | 'copy' | 'open', payload: any) => void
}) {
  const filterNode = (n: TreeNode): boolean => {
    if (n.isDirectory) return true
    if (filter !== 'all' && getFileKind(n.name) !== filter) return false
    if (search && !n.name.toLowerCase().includes(search)) return false
    return true
  }

  return (
    <div>
      {nodes.map(n => (
        <TreeNodeRow
          key={n.path}
          node={n}
          depth={0}
          expanded={expanded}
          onToggle={onToggle}
          filterNode={filterNode}
          renamingPath={renamingPath}
          creatingIn={creatingIn}
          setRenamingPath={setRenamingPath}
          setCreatingIn={setCreatingIn}
          onContextMenu={onContextMenu}
          onAction={onAction}
        />
      ))}
    </div>
  )
}

function TreeNodeRow({ node, depth, expanded, onToggle, filterNode,
  renamingPath, creatingIn, setRenamingPath, setCreatingIn,
  onContextMenu, onAction }: {
  node: TreeNode
  depth: number
  expanded: Set<string>
  onToggle: (path: string) => void
  filterNode: (n: TreeNode) => boolean
  renamingPath: string | null
  creatingIn: { parentPath: string; type: 'file' | 'folder' } | null
  setRenamingPath: (p: string | null) => void
  setCreatingIn: (c: { parentPath: string; type: 'file' | 'folder' } | null) => void
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void
  onAction: (action: 'create' | 'rename' | 'delete' | 'copy' | 'open', payload: any) => void
}) {
  const isDir = node.isDirectory
  const isOpen = expanded.has(node.path)
  const isRenaming = renamingPath === node.path
  const isCreatingHere = creatingIn?.parentPath === node.path

  if (isDir) {
    const children = (node.children ?? []).filter(filterNode)
    if (children.length === 0 && depth > 0 && !isCreatingHere) return null
    return (
      <>
        {isRenaming ? (
          <InlineInput
            depth={depth}
            isDir
            initialValue={node.name}
            onCommit={(name) => { setRenamingPath(null); onAction('rename', { oldPath: node.path, newName: name }) }}
            onCancel={() => setRenamingPath(null)}
          />
        ) : (
          <div
            onClick={() => onToggle(node.path)}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, node) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: `4px 12px 4px ${12 + depth * 14}px`,
              fontSize: 12, color: '#5a5a5a', cursor: 'pointer',
              userSelect: 'none',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#ebe7e0')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ fontSize: 9, color: '#888', width: 10, textAlign: 'center' }}>
              {isOpen ? '▾' : '▸'}
            </span>
            <FolderIcon small />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {node.name}
            </span>
          </div>
        )}
        {isOpen && children.map(c => (
          <TreeNodeRow
            key={c.path}
            node={c}
            depth={depth + 1}
            expanded={expanded}
            onToggle={onToggle}
            filterNode={filterNode}
            renamingPath={renamingPath}
            creatingIn={creatingIn}
            setRenamingPath={setRenamingPath}
            setCreatingIn={setCreatingIn}
            onContextMenu={onContextMenu}
            onAction={onAction}
          />
        ))}
        {isCreatingHere && (
          <InlineInput
            depth={depth + 1}
            isDir={creatingIn?.type === 'folder'}
            initialValue=""
            placeholder={creatingIn?.type === 'folder' ? '新建文件夹' : '新建文件.txt'}
            onCommit={(name) => { setCreatingIn(null); onAction('create', { parentPath: node.path, name, type: creatingIn?.type }) }}
            onCancel={() => setCreatingIn(null)}
          />
        )}
      </>
    )
  }

  if (isRenaming) {
    return (
      <InlineInput
        depth={depth}
        isDir={false}
        initialValue={node.name}
        onCommit={(name) => { setRenamingPath(null); onAction('rename', { oldPath: node.path, newName: name }) }}
        onCancel={() => setRenamingPath(null)}
      />
    )
  }

  return (
    <div
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, node) }}
      onDoubleClick={() => { if (!node.isDirectory) onAction('open', { path: node.path }) }}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: `4px 12px 4px ${12 + depth * 14 + 14}px`,
        fontSize: 12, color: '#666', cursor: 'default',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#ebe7e0')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      title={node.path}
    >
      <span style={{ width: 10 }} />
      <FileIcon kind={getFileKind(node.name)} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {node.name}
      </span>
      <span style={{ fontSize: 10, color: '#bbb' }}>{formatSize(node.size)}</span>
    </div>
  )
}

// ─── Inline Input (rename / new file) ────────────────────────
function InlineInput({ depth, isDir, initialValue, placeholder, onCommit, onCancel }: {
  depth: number
  isDir: boolean
  initialValue: string
  placeholder?: string
  onCommit: (value: string) => void
  onCancel: () => void
}) {
  const [v, setV] = useState(initialValue)
  const ref = React.useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: `3px 12px 3px ${12 + depth * 14 + (isDir ? 0 : 14)}px`,
    }}>
      {isDir
        ? <FolderIcon small />
        : <span style={{ width: 10 }} />}
      <input
        ref={ref}
        value={v}
        placeholder={placeholder}
        onChange={e => setV(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); v.trim() && onCommit(v.trim()) }
          else if (e.key === 'Escape') onCancel()
        }}
        onBlur={() => v.trim() && v !== initialValue ? onCommit(v.trim()) : onCancel()}
        onClick={e => e.stopPropagation()}
        onContextMenu={e => e.stopPropagation()}
        style={{
          flex: 1, padding: '1px 4px',
          border: '1px solid #667eea', borderRadius: 3,
          fontSize: 12, outline: 'none', fontFamily: 'inherit',
          background: 'white', color: '#333',
        }}
      />
    </div>
  )
}

// ─── File Context Menu ────────────────────────────────────────
function FileContextMenu({ x, y, node, onClose, onAction }: {
  x: number; y: number; node: TreeNode
  onClose: () => void
  onAction: (action: 'newFile' | 'newFolder' | 'rename' | 'delete' | 'copy') => void
}) {
  const adjustedX = Math.min(x, window.innerWidth - 180)
  const adjustedY = Math.min(y, window.innerHeight - 220)
  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed', top: adjustedY, left: adjustedX, zIndex: 1000,
        background: 'white', border: '1px solid #d4cfc6', borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)', padding: 4, minWidth: 160,
      }}
    >
      {node.isDirectory && (
        <>
          <MenuItem icon="📄" label="新建文件" onClick={() => onAction('newFile')} />
          <MenuItem icon="📁" label="新建文件夹" onClick={() => onAction('newFolder')} />
          <div style={{ height: 1, background: '#e8e4df', margin: '4px 0' }} />
        </>
      )}
      <MenuItem icon="✏️" label="重命名" onClick={() => onAction('rename')} />
      <MenuItem icon="📋" label="复制路径" onClick={() => onAction('copy')} />
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

function FileIcon({ kind }: { kind: 'code' | 'text' | 'image' | 'binary' }) {
  if (kind === 'code') return <span style={{ fontSize: 12 }}>📜</span>
  if (kind === 'text') return <span style={{ fontSize: 12 }}>📃</span>
  if (kind === 'image') return <span style={{ fontSize: 12 }}>🖼️</span>
  return <span style={{ fontSize: 12 }}>📄</span>
}

// ─── File Row (dropped files) ─────────────────────────────────
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
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, color: '#666',
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

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// ─── Icons ────────────────────────────────────────────────────
function FolderIcon({ small }: { small?: boolean } = {}) {
  const size = small ? 12 : 14
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"></polyline>
      <polyline points="1 20 1 14 7 14"></polyline>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

function AddFileIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  )
}

function AddFolderIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </svg>
  )
}

// ─── Session Status Card ──────────────────────────────────────
function SessionStatusCard({ workspace, modelName, thinkingLevel, fileCount }: {
  workspace: string
  modelName: string
  thinkingLevel: string
  fileCount: number
}) {
  const folderName = workspace.split(/[\\/]/).filter(Boolean).pop() || workspace
  return (
    <div style={{
      margin: '12px 12px 20px',
      padding: '12px 14px',
      background: 'white',
      border: '1px solid #e8e4df',
      borderRadius: 10,
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        会话状态
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <StatusRow icon="📁" label="工作目录" value={folderName} />
        <StatusRow icon="🧠" label="模型" value={modelName} />
        <StatusRow icon="💡" label="思考深度" value={thinkingLevel} />
        <StatusRow icon="📄" label="文件数" value={String(fileCount)} />
      </div>
    </div>
  )
}

function StatusRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ fontSize: 12, color: '#888', minWidth: 52 }}>{label}</span>
      <span style={{ fontSize: 12, color: '#333', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </span>
    </div>
  )
}


// @ts-nocheck
import { useState } from 'react'
import { useStore } from '../store'
import { SessionTodoCard } from './SessionTodoCard'
import { WorkflowCard } from './WorkflowCard'
import styles from './WorkspaceCompanionRail.module.css'

type View = 'todo' | 'activity' | 'files' | 'workflow'

const ICONS: Record<View, React.ReactNode> = {
  todo: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  activity: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  files: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  ),
  workflow: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="15" y="15" width="6" height="6" rx="1" />
      <path d="M9 6h7a2 2 0 0 1 2 2v7" />
    </svg>
  ),
}

const LABELS: Record<View, string> = {
  todo: '任务',
  activity: '活动',
  files: '文件',
  workflow: '工作流',
}

export function WorkspaceCompanionRail() {
  const [view, setView] = useState<View>('todo')
  const sessionTodos = useStore(s => s.sessionTodos)
  const workflow = useStore(s => s.workflow)
  const agentActivity = useStore(s => s.agentActivity)
  const files = useStore(s => s.files)

  const badges: Record<View, number> = {
    todo: sessionTodos.filter(t => t.status !== 'completed' && t.status !== 'failed').length,
    activity: agentActivity ? 1 : 0,
    files: files.length,
    workflow: workflow ? 1 : 0,
  }

  return (
    <div className={styles.container}>
      <div className={styles.rail}>
        {(Object.keys(ICONS) as View[]).map(v => (
          <button
            key={v}
            type="button"
            className={styles.railBtn}
            data-active={view === v}
            onClick={() => setView(v)}
            title={LABELS[v]}
            aria-label={LABELS[v]}
          >
            {ICONS[v]}
            {badges[v] > 0 && <span className={styles.badge}>{badges[v]}</span>}
          </button>
        ))}
      </div>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>{LABELS[view]}</div>
        <div className={styles.panelBody}>
          {view === 'todo' && <SessionTodoCard />}
          {view === 'activity' && <AgentActivityView />}
          {view === 'files' && <AttachedFilesView />}
          {view === 'workflow' && <WorkflowCard />}
          {view === 'todo' && sessionTodos.length === 0 && <EmptyHint text="暂无任务" />}
          {view === 'activity' && !agentActivity && <EmptyHint text="暂无活动" />}
          {view === 'files' && files.length === 0 && <EmptyHint text="暂无文件" />}
          {view === 'workflow' && !workflow && <EmptyHint text="暂无工作流" />}
        </div>
      </div>
    </div>
  )
}

function AgentActivityView() {
  const a = useStore(s => s.agentActivity)
  if (!a) return null
  return (
    <div className={styles.activityCard}>
      <div className={styles.activityStep}>{a.step}</div>
      <div className={styles.activityMeta}>已运行 {a.elapsed}s</div>
      {a.lastResult && <div className={styles.activityResult}>{a.lastResult}</div>}
    </div>
  )
}

function AttachedFilesView() {
  const files = useStore(s => s.files)
  if (files.length === 0) return null
  return (
    <ul className={styles.fileList}>
      {files.map((f, i) => (
        <li key={i} className={styles.fileItem}>
          <span>{f.isDirectory ? '📁' : '📄'}</span>
          <span className={styles.fileName}>{f.name}</span>
        </li>
      ))}
    </ul>
  )
}

function EmptyHint({ text }: { text: string }) {
  return <div className={styles.empty}>{text}</div>
}

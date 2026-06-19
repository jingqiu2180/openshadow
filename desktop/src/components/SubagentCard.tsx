// @ts-nocheck
import { useState, useCallback } from 'react'
import styles from './SubagentCard.module.css'

interface Props {
  taskId: string
  agentName: string
  status: 'running' | 'success' | 'failed' | 'aborted'
  summary?: string
  onExpand?: () => void
}

export function SubagentCard({ taskId, agentName, status, summary, onExpand }: Props) {
  const [expanded, setExpanded] = useState(false)
  const toggle = useCallback(() => {
    setExpanded(v => !v)
    onExpand?.()
  }, [onExpand])

  return (
    <div className={styles.card} data-status={status}>
      <button
        type="button"
        className={styles.header}
        onClick={toggle}
        aria-expanded={expanded}
      >
        <span className={styles.avatar}>
          {status === 'running' ? <span className={styles.spinner} /> : agentName.slice(0, 1).toUpperCase()}
        </span>
        <span className={styles.body}>
          <span className={styles.titleRow}>
            <span className={styles.title}>{agentName}</span>
            <span className={styles.taskId}>#{taskId.slice(0, 8)}</span>
          </span>
          <span className={styles.summary}>
            {status === 'running' && '执行中...'}
            {status === 'success' && (summary || '完成')}
            {status === 'failed' && '失败'}
            {status === 'aborted' && '已中止'}
          </span>
        </span>
        <span className={styles.chevron} data-open={expanded}>›</span>
      </button>
    </div>
  )
}

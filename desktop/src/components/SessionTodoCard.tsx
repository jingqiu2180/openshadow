// @ts-nocheck
import { useStore } from '../store'
import styles from './SessionTodoCard.module.css'

export function SessionTodoCard() {
  const todos = useStore(s => s.sessionTodos)
  const agentActivity = useStore(s => s.agentActivity)
  if (todos.length === 0 && !agentActivity) return null

  const done = todos.filter(t => t.status === 'completed').length
  const total = todos.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>会话任务</span>
        {total > 0 && (
          <span className={styles.progress}>
            {done} / {total}
          </span>
        )}
      </div>
      {total > 0 && (
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>
      )}
      <ul className={styles.todoList}>
        {todos.map(todo => (
          <li
            key={todo.id}
            className={styles.todoItem}
            data-status={todo.status}
          >
            <span className={styles.todoIcon} aria-hidden="true">
              {todo.status === 'completed' && '✓'}
              {todo.status === 'failed' && '✗'}
              {todo.status === 'in_progress' && (
                <span className={styles.todoSpinner} />
              )}
              {todo.status === 'pending' && '○'}
            </span>
            <span className={styles.todoText}>
              {todo.status === 'in_progress' && todo.activeForm
                ? todo.activeForm
                : todo.content}
            </span>
          </li>
        ))}
      </ul>
      {agentActivity && (
        <div className={styles.activityRow}>
          <span className={styles.activityDot} />
          <span className={styles.activityStep}>{agentActivity.step}</span>
          <span className={styles.activityElapsed}>
            {formatElapsed(agentActivity.elapsed)}
          </span>
        </div>
      )}
    </div>
  )
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

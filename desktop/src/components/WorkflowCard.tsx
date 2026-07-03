import { useStore } from '../store'
import styles from './SessionTodoCard.module.css'

export function WorkflowCard() {
  const workflow = useStore(s => s.workflow)
  if (!workflow) return null

  const done = workflow.steps.filter(s => s.status === 'done').length
  const total = workflow.steps.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>工作流 · {workflow.name}</span>
        <span className={styles.progress}>
          {done} / {total}
        </span>
      </div>
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${pct}%` }} />
      </div>
      <ol className={styles.todoList} style={{ listStyle: 'none' }}>
        {workflow.steps.map((step, i) => (
          <li
            key={i}
            className={styles.todoItem}
            data-status={step.status}
          >
            <span className={styles.todoIcon} aria-hidden="true">
              {step.status === 'done' && '✓'}
              {step.status === 'error' && '✗'}
              {step.status === 'running' && <span className={styles.todoSpinner} />}
              {step.status === 'pending' && '○'}
            </span>
            <span className={styles.todoText}>{step.name}</span>
            {i === workflow.currentStep && step.status === 'running' && (
              <span style={{ fontSize: 11, color: '#c5a878' }}>执行中</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

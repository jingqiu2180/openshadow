import { useStore } from '../store'
import styles from './SessionConfirmationPrompt.module.css'

export function SessionConfirmationPrompt() {
  const prompt = useStore(s => s.confirmationPrompt)
  const resolve = useStore(s => s.resolveConfirmation)

  if (!prompt) return null

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.icon}>🔐</span>
          <span className={styles.title}>{prompt.title}</span>
        </div>
        <div className={styles.body}>{prompt.description}</div>
        {prompt.toolName && (
          <div className={styles.toolRow}>
            <span className={styles.toolLabel}>工具</span>
            <code className={styles.toolName}>{prompt.toolName}</code>
          </div>
        )}
        {prompt.args !== undefined && (
          <pre className={styles.args}>{JSON.stringify(prompt.args, null, 2)}</pre>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnDeny}`}
            onClick={() => resolve('deny')}
          >
            拒绝
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnAllowOnce}`}
            onClick={() => resolve('allow')}
          >
            允许一次
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnAlways}`}
            onClick={() => resolve('always')}
          >
            始终允许
          </button>
        </div>
      </div>
    </div>
  )
}

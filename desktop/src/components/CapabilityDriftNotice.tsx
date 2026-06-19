// @ts-nocheck
import { useStore } from '../store'
import styles from './CapabilityDriftNotice.module.css'

export function CapabilityDriftNotice() {
  const drift = useStore(s => s.capabilityDrift)
  const setDrift = useStore(s => s.setCapabilityDrift)
  if (!drift) return null

  return (
    <div className={styles.notice} data-severity={drift.severity}>
      <div className={styles.icon}>
        {drift.severity === 'error' && '⛔'}
        {drift.severity === 'warning' && '⚠️'}
        {drift.severity === 'info' && 'ℹ️'}
      </div>
      <div className={styles.body}>
        <div className={styles.title}>{drift.title}</div>
        <div className={styles.detail}>{drift.detail}</div>
      </div>
      {drift.dismissable && (
        <button
          className={styles.close}
          onClick={() => setDrift(null)}
          aria-label="关闭提示"
        >×</button>
      )}
    </div>
  )
}

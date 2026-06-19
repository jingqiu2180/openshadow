// @ts-nocheck
import { useStore } from '../store'
import styles from './SettingsConfirmCard.module.css'

export function SettingsConfirmCard() {
  const confirm = useStore(s => s.settingsConfirm)
  const update = useStore(s => s.settingsUpdate)
  const resolve = useStore(s => s.resolveSettingsConfirm)
  const setUpdate = useStore(s => s.setSettingsUpdate)
  const pushToast = useStore(s => s.pushToast)

  if (!confirm && !update) return null

  if (confirm) {
    return (
      <div className={`${styles.card} ${styles.confirm}`}>
        <div className={styles.header}>
          <span className={styles.icon}>⚙️</span>
          <span className={styles.title}>配置变更</span>
        </div>
        <div className={styles.body}>{confirm.description}</div>
        <div className={styles.diff}>
          <div className={styles.diffOld}>
            <span className={styles.diffLabel}>旧值</span>
            <code>{String(JSON.stringify(confirm.oldValue))}</code>
          </div>
          <div className={styles.diffArrow}>→</div>
          <div className={styles.diffNew}>
            <span className={styles.diffLabel}>新值</span>
            <code>{String(JSON.stringify(confirm.newValue))}</code>
          </div>
        </div>
        <div className={styles.actions}>
          <button
            className={styles.btnCancel}
            onClick={() => { resolve(false); pushToast('info', '已取消') }}
          >拒绝</button>
          <button
            className={styles.btnAccept}
            onClick={() => { resolve(true); pushToast('success', '已应用') }}
          >接受</button>
        </div>
      </div>
    )
  }

  if (update) {
    return (
      <div className={`${styles.card} ${styles.update}`}>
        <span className={styles.icon}>🔄</span>
        <div className={styles.body}>
          <strong>配置已更新</strong>
          <div className={styles.updateDetail}>{update.description}</div>
        </div>
        <button
          className={styles.btnClose}
          onClick={() => setUpdate(null)}
          aria-label="关闭"
        >×</button>
      </div>
    )
  }

  return null
}

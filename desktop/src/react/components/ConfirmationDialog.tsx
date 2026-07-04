import { useState } from 'react';
import { useStore } from '../stores';
import styles from './ConfirmationDialog.module.css';

export function ConfirmationDialog() {
  const confirm = useStore(s => s.pendingConfirm);
  const setPendingConfirm = useStore(s => s.setPendingConfirm);
  const [busy, setBusy] = useState(false);
  const isDestructive = confirm?.tone === 'danger';

  const handleCancel = () => {
    if (busy) return;
    confirm?.onCancel?.();
    setPendingConfirm(null);
  };

  const handleConfirm = async () => {
    if (busy || !confirm) return;
    setBusy(true);
    try {
      await confirm.onConfirm();
      setPendingConfirm(null);
    } catch {
      // Keep the dialog open on failure so callers can surface errors and let users retry.
    } finally {
      setBusy(false);
    }
  };

  if (!confirm) return null;

  return (
    <div className={styles.overlay} onClick={handleCancel}>
      <div
        className={`${styles.box}${isDestructive ? ` ${styles.danger}` : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-dialog-title"
        tabIndex={-1}
      >
        <h3 id="confirmation-dialog-title" className={styles.title}>{confirm.title || 'Confirm'}</h3>
        <div className={styles.body}>
          <p>{confirm.message}</p>
          {confirm.detail ? <p className={styles.detail}>{confirm.detail}</p> : null}
        </div>
        <div className={styles.actions}>
          <button className={styles.cancel} onClick={handleCancel} disabled={busy}>
            {confirm.cancelLabel || 'Cancel'}
          </button>
          <button className={`${styles.confirm}${isDestructive ? ` ${styles.danger}` : ''}`} onClick={handleConfirm} disabled={busy}>
            {busy ? 'Executing...' : (confirm.confirmLabel || 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

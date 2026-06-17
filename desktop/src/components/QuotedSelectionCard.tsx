import { useStore } from '../store'
import styles from './ChatArea.module.css'

export function QuotedSelectionCard() {
  const quotedSelection = useStore(s => s.quotedSelection)
  const setQuotedSelection = useStore(s => s.setQuotedSelection)
  if (!quotedSelection) return null

  const display = quotedSelection.length > 60
    ? quotedSelection.slice(0, 60) + '…'
    : quotedSelection

  return (
    <div className={styles.quotedCard}>
      <span className={styles.quotedIcon} aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h2c0 4-2 5-3 5z" />
          <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h2c0 4-2 5-3 5z" />
        </svg>
      </span>
      <span className={styles.quotedText} title={quotedSelection}>{display}</span>
      <button
        type="button"
        className={styles.quotedRemove}
        onClick={() => setQuotedSelection(null)}
        aria-label="清除引用"
        title="清除引用"
      >
        ×
      </button>
    </div>
  )
}

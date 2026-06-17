import { useEffect, useRef, useState, useCallback } from 'react'
import styles from './DeskEditor.module.css'

interface Props {
  filePath: string
  content: string
  onClose: () => void
  onSave: (newContent: string) => Promise<void>
}

export function DeskEditor({ filePath, content, onClose, onSave }: Props) {
  const [draft, setDraft] = useState(content)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [wordWrap, setWordWrap] = useState(true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setDraft(content)
    setDirty(false)
  }, [content, filePath])

  const handleChange = useCallback((v: string) => {
    setDraft(v)
    setDirty(v !== content)
  }, [content])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await onSave(draft)
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }, [draft, onSave])

  // Ctrl+S 保存
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (dirty) void handleSave()
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dirty, handleSave, onClose])

  const lines = draft.split('\n').length
  const fileName = filePath.split(/[\\/]/).pop() || filePath

  return (
    <div className={styles.editor}>
      <div className={styles.toolbar}>
        <span className={styles.fileName} title={filePath}>
          {fileName}
          {dirty && <span className={styles.dirty}> ●</span>}
        </span>
        <span className={styles.meta}>{lines} 行 · {draft.length} 字符</span>
        <div className={styles.spacer} />
        <label className={styles.wrapToggle}>
          <input
            type="checkbox"
            checked={wordWrap}
            onChange={e => setWordWrap(e.target.checked)}
          />
          <span>换行</span>
        </label>
        <button
          type="button"
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={!dirty || saving}
        >
          {saving ? '保存中…' : '保存'}
        </button>
        <button type="button" className={styles.closeBtn} onClick={onClose} title="关闭 (Esc)">
          ×
        </button>
      </div>
      <div className={styles.body}>
        <div className={styles.gutter}>
          {Array.from({ length: lines }, (_, i) => (
            <div key={i} className={styles.gutterLine}>{i + 1}</div>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={draft}
          onChange={e => handleChange(e.target.value)}
          spellCheck={false}
          wrap={wordWrap ? 'soft' : 'off'}
        />
      </div>
    </div>
  )
}

import React, { memo } from 'react'
import styles from './ChatArea.module.css'

interface Props {
  /** 正在执行 slash 命令的标签 */
  slashBusyLabel: string | null
  /** 正在压缩中 */
  compactingLabel: string | null
  /** 错误信息 */
  inlineError: string | null
  /** slash 执行结果 */
  slashResult: { text: string; type: 'success' | 'error'; deskDir?: string } | null
  onResultClick?: () => void
}

/** 输入区域上方的内联状态反馈条 */
const InputStatusBars = memo(function InputStatusBars({
  slashBusyLabel, compactingLabel, inlineError, slashResult, onResultClick,
}: Props) {
  return (
    <>
      {slashBusyLabel && (
        <div className={styles.statusBar}>
          <span className={styles.statusDot} />
          <span>{slashBusyLabel}</span>
        </div>
      )}
      {compactingLabel && (
        <div className={styles.statusBar}>
          <span className={styles.statusDot} />
          <span>{compactingLabel}</span>
        </div>
      )}
      {inlineError && (
        <div className={`${styles.statusBar} ${styles.statusBarError}`}>
          <span className={styles.statusDotError} />
          <span>{inlineError}</span>
        </div>
      )}
      {!slashBusyLabel && !compactingLabel && !inlineError && slashResult && (
        <div
          className={`${styles.statusBar} ${styles.statusBarResult} ${slashResult.deskDir ? ` ${styles.statusBarClickable}` : ''}`}
          onClick={onResultClick}
          role={slashResult.deskDir ? 'button' : undefined}
        >
          <span className={slashResult.type === 'success' ? styles.statusDotOk : styles.statusDotErr} />
          <span>{slashResult.text}</span>
        </div>
      )}
    </>
  )
})

export default InputStatusBars

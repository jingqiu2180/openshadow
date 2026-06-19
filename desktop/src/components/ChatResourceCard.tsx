// @ts-nocheck
import type { ReactNode, CSSProperties } from 'react'
import styles from './ChatResourceCard.module.css'

export type ChatResourceCardTone = 'neutral' | 'success' | 'danger' | 'muted' | 'accent'

interface Props {
  icon: ReactNode
  title: ReactNode
  titleMeta?: ReactNode
  subtitle?: ReactNode
  statusLabel?: ReactNode
  statusTone?: ChatResourceCardTone
  actionSlot?: ReactNode
  onClick?: () => void
  expanded?: boolean
  expandable?: boolean
  disabled?: boolean
  className?: string
  ariaLabel?: string
  children?: ReactNode
  /** 整卡右上角内联风格 */
  style?: CSSProperties
}

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function ChatResourceCard({
  icon,
  title,
  titleMeta,
  subtitle,
  statusLabel,
  statusTone = 'neutral',
  actionSlot,
  onClick,
  expanded = false,
  expandable = false,
  disabled = false,
  className,
  ariaLabel,
  children,
  style,
}: Props) {
  const interactive = !!onClick && !disabled
  const rootClass = cx(
    styles.card,
    interactive && styles.interactive,
    expanded && styles.expanded,
    disabled && styles.disabled,
    className,
  )

  return (
    <div className={rootClass} data-chat-resource-card="" style={style}>
      <div className={styles.header}>
        {interactive ? (
          <button
            type="button"
            className={styles.main}
            onClick={onClick}
            aria-label={ariaLabel}
            aria-expanded={expandable ? expanded : undefined}
          >
            <span className={styles.icon} aria-hidden="true">{icon}</span>
            <span className={styles.body}>
              <span className={styles.titleRow}>
                <span className={styles.title}>{title}</span>
                {titleMeta && <span className={styles.titleMeta}>{titleMeta}</span>}
                {statusLabel && (
                  <span className={cx(styles.status, styles[`status-${statusTone}`])}>
                    {statusLabel}
                  </span>
                )}
              </span>
              {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
            </span>
            {expandable && (
              <span className={cx(styles.chevron, expanded && styles.chevronExpanded)} aria-hidden="true">
                ›
              </span>
            )}
          </button>
        ) : (
          <div className={styles.main} aria-label={ariaLabel} aria-disabled={disabled || undefined}>
            <span className={styles.icon} aria-hidden="true">{icon}</span>
            <span className={styles.body}>
              <span className={styles.titleRow}>
                <span className={styles.title}>{title}</span>
                {titleMeta && <span className={styles.titleMeta}>{titleMeta}</span>}
                {statusLabel && (
                  <span className={cx(styles.status, styles[`status-${statusTone}`])}>
                    {statusLabel}
                  </span>
                )}
              </span>
              {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
            </span>
            {expandable && (
              <span className={cx(styles.chevron, expanded && styles.chevronExpanded)} aria-hidden="true">
                ›
              </span>
            )}
          </div>
        )}
        {actionSlot && <div className={styles.actions}>{actionSlot}</div>}
      </div>
      {children && expanded && <div className={styles.details}>{children}</div>}
    </div>
  )
}

/** FileOutputActions — 文件操作小工具栏 (copy / open) */
interface FileOutputActionsProps {
  filePath: string
  displayName: string
  onOpen?: () => void
  onCopy?: () => void
}

function OpenIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}
function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

export function FileOutputActions({ displayName, onOpen, onCopy }: FileOutputActionsProps) {
  return (
    <div className={styles.fileActions}>
      {onOpen && (
        <button
          type="button"
          className={styles.fileActionBtn}
          onClick={onOpen}
          title={`打开 ${displayName}`}
          aria-label={`打开 ${displayName}`}
        >
          <OpenIcon />
        </button>
      )}
      {onCopy && (
        <button
          type="button"
          className={styles.fileActionBtn}
          onClick={onCopy}
          title={`复制 ${displayName} 路径`}
          aria-label={`复制 ${displayName} 路径`}
        >
          <CopyIcon />
        </button>
      )}
    </div>
  )
}

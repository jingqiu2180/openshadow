// @ts-nocheck
import React, { useState, useCallback } from 'react'
import styles from './CodeBlock.module.css'

interface Props {
  language?: string
  value: string
}

export function CodeBlock({ language, value }: Props) {
  const [wrap, setWrap] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {
      // Fallback: select the text manually
      const ta = document.createElement('textarea')
      ta.value = value
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [value])

  return (
    <div className={styles.wrapper}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <span className={styles.lang}>
          {language || 'text'}
        </span>
        <div className={styles.actions}>
          <button className={styles.btn} onClick={() => setWrap((w) => !w)} title={wrap ? '不折行' : '折行'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points={wrap ? '17 1 21 5 17 9' : '4 6 16 6 16 20'} />
              <path d={wrap ? 'M3 11V6a2 2 0 012-2h14' : 'M14 4l2 2-2 2'} />
            </svg>
          </button>
          <button className={styles.btn} onClick={handleCopy} title="复制">
            {copied ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ca64c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Code */}
      <pre className={`${styles.pre}${wrap ? ` ${styles.wrap}` : ''}`}>
        <code className={language ? `language-${language}` : ''}>
          {value}
        </code>
      </pre>
    </div>
  )
}

import { useEffect, useState, useRef, useCallback } from 'react'
import styles from './ChatTimelineNavigator.module.css'

interface Anchor {
  messageId: string
  label: string
  type: 'user' | 'assistant'
}

interface Props {
  anchors: Anchor[]
  scrollRef: React.RefObject<HTMLDivElement | null>
  messageElementsRef: React.RefObject<Map<string, HTMLDivElement>>
}

export function ChatTimelineNavigator({ anchors, scrollRef, messageElementsRef }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [hoverLabel, setHoverLabel] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)

  // 鼠标进入 scroll 容器时显示导航
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onEnter = () => setVisible(true)
    const onLeave = () => { setVisible(false); setHoverLabel(null) }
    el.addEventListener('mouseenter', onEnter)
    el.addEventListener('mouseleave', onLeave)
    return () => {
      el.removeEventListener('mouseenter', onEnter)
      el.removeEventListener('mouseleave', onLeave)
    }
  }, [scrollRef])

  // 监听滚动更新 active
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const top = el.scrollTop + el.clientHeight * 0.4
      let lastId: string | null = null
      for (const anchor of anchors) {
        const node = messageElementsRef.current?.get(anchor.messageId)
        if (!node) continue
        const offsetTop = node.offsetTop
        if (offsetTop <= top) lastId = anchor.messageId
      }
      setActiveId(lastId)
    }
    el.addEventListener('scroll', onScroll)
    onScroll()
    return () => el.removeEventListener('scroll', onScroll)
  }, [anchors, scrollRef, messageElementsRef])

  const handleClick = useCallback((messageId: string) => {
    const node = messageElementsRef.current?.get(messageId)
    const el = scrollRef.current
    if (!node || !el) return
    el.scrollTo({ top: node.offsetTop - 20, behavior: 'smooth' })
  }, [messageElementsRef, scrollRef])

  if (anchors.length === 0) return null

  return (
    <div
      className={styles.rail}
      data-visible={visible}
      onMouseEnter={() => setVisible(true)}
    >
      {anchors.map((anchor) => {
        const isActive = activeId === anchor.messageId
        return (
          <button
            key={anchor.messageId}
            type="button"
            className={styles.dot}
            data-type={anchor.type}
            data-active={isActive}
            onClick={() => handleClick(anchor.messageId)}
            onMouseEnter={() => setHoverLabel(anchor.label)}
            onMouseLeave={() => setHoverLabel(null)}
            aria-label={`跳到 ${anchor.label}`}
          />
        )
      })}
      {hoverLabel && (
        <div className={styles.tooltip}>{hoverLabel}</div>
      )}
    </div>
  )
}

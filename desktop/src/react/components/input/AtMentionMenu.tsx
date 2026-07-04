/**
 * AtMentionMenu — @ 提及菜单
 *
 * 输入 @ 时弹出，用于快速引用 Agent、用户或文件。
 */

import { useState, useEffect, useRef } from 'react';

export interface AtMentionItem {
  id: string;
  label: string;
  type: 'agent' | 'user' | 'file' | 'channel';
  icon?: string;
  description?: string;
}

export interface AtMentionMenuProps {
  visible: boolean;
  items: AtMentionItem[];
  onSelect: (item: AtMentionItem) => void;
  onClose: () => void;
  position?: { x: number; y: number };
}

export function AtMentionMenu({ visible, items, onSelect, onClose, position }: AtMentionMenuProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveIndex(0);
  }, [items]);

  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (items[activeIndex]) onSelect(items[activeIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, items, activeIndex, onSelect, onClose]);

  if (!visible || items.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="at-mention-menu"
      style={position ? { top: position.y, left: position.x } : undefined}
    >
      {items.map((item, i) => (
        <div
          key={item.id}
          className={`at-mention-item ${i === activeIndex ? 'active' : ''}`}
          onClick={() => onSelect(item)}
          onMouseEnter={() => setActiveIndex(i)}
        >
          {item.icon && <span className="at-mention-icon">{item.icon}</span>}
          <div className="at-mention-text">
            <div className="at-mention-label">{item.label}</div>
            {item.description && (
              <div className="at-mention-description">{item.description}</div>
            )}
          </div>
          <span className="at-mention-type">{item.type}</span>
        </div>
      ))}
    </div>
  );
}

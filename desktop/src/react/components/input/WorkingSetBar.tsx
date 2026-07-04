/**
 * WorkingSetBar — 工作集栏
 *
 * 显示当前会话引用的文件、Agent、上下文等。
 */

import { useState } from 'react';

export interface WorkingSetItem {
  id: string;
  type: 'file' | 'agent' | 'context' | 'memory';
  label: string;
  detail?: string;
  removable?: boolean;
}

export interface WorkingSetBarProps {
  items: WorkingSetItem[];
  onRemove?: (id: string) => void;
  onClear?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function WorkingSetBar({
  items,
  onRemove,
  onClear,
  collapsed = false,
  onToggleCollapse,
}: WorkingSetBarProps) {
  const [localCollapsed, setLocalCollapsed] = useState(collapsed);

  const isCollapsed = onToggleCollapse ? collapsed : localCollapsed;
  const toggleCollapse = onToggleCollapse || (() => setLocalCollapsed((c) => !c));

  if (items.length === 0) return null;

  return (
    <div className={`working-set-bar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="working-set-header" onClick={toggleCollapse}>
        <span className="working-set-icon">{isCollapsed ? '▸' : '▾'}</span>
        <span className="working-set-title">工作集</span>
        <span className="working-set-count">{items.length}</span>
      </div>

      {!isCollapsed && (
        <div className="working-set-items">
          {items.map((item) => (
            <div key={item.id} className={`working-set-item working-set-${item.type}`}>
              <span className="working-set-item-icon">
                {item.type === 'file' && '📄'}
                {item.type === 'agent' && '🤖'}
                {item.type === 'context' && '💭'}
                {item.type === 'memory' && '🧠'}
              </span>
              <span className="working-set-item-label">{item.label}</span>
              {item.detail && (
                <span className="working-set-item-detail">{item.detail}</span>
              )}
              {item.removable !== false && onRemove && (
                <button
                  className="working-set-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(item.id);
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {onClear && items.length > 1 && (
            <button className="working-set-clear" onClick={onClear}>
              清除全部
            </button>
          )}
        </div>
      )}
    </div>
  );
}

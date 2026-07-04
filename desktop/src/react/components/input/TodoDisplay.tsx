/**
 * TodoDisplay — Todo 列表显示
 *
 * 显示当前任务的待办事项列表，支持勾选和编辑。
 */

import { useState } from 'react';

export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  activeForm?: string;
}

export interface TodoDisplayProps {
  items: TodoItem[];
  onItemClick?: (id: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const STATUS_ICONS: Record<string, string> = {
  pending: '○',
  in_progress: '◐',
  completed: '✓',
  cancelled: '✗',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'var(--text-muted, #999)',
  in_progress: 'var(--info, #2196f3)',
  completed: 'var(--success, #4caf50)',
  cancelled: 'var(--text-muted, #999)',
};

export function TodoDisplay({ items, onItemClick, collapsed = false, onToggleCollapse }: TodoDisplayProps) {
  const [localCollapsed, setLocalCollapsed] = useState(collapsed);
  const isCollapsed = onToggleCollapse ? collapsed : localCollapsed;
  const toggleCollapse = onToggleCollapse || (() => setLocalCollapsed((c) => !c));

  if (items.length === 0) return null;

  const completed = items.filter((i) => i.status === 'completed').length;
  const total = items.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className={`todo-display ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="todo-header" onClick={toggleCollapse}>
        <span className="todo-icon">{isCollapsed ? '▸' : '▾'}</span>
        <span className="todo-title">任务进度</span>
        <span className="todo-stats">
          {completed}/{total} · {percent}%
        </span>
        <div className="todo-progress-bar">
          <div className="todo-progress-fill" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {!isCollapsed && (
        <div className="todo-items">
          {items.map((item) => (
            <div
              key={item.id}
              className={`todo-item todo-item-${item.status}`}
              onClick={() => onItemClick?.(item.id)}
            >
              <span
                className="todo-status-icon"
                style={{ color: STATUS_COLORS[item.status] }}
              >
                {STATUS_ICONS[item.status]}
              </span>
              <span className="todo-content">
                {item.status === 'in_progress' && item.activeForm
                  ? item.activeForm
                  : item.content}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

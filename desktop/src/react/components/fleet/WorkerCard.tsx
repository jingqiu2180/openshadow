/**
 * WorkerCard — 单个 Worker 的实时视图
 *
 * 显示状态指示器、进度、文件变更、错误信息，
 * 支持取消/重试/打开 worktree 等操作。
 */

import { useState } from 'react';
import type { FleetWorkerView } from './fleet-sort';

const STATUS_LABELS: Record<string, string> = {
  blocked: '阻塞',
  failed: '失败',
  waiting_approval: '待审批',
  running: '运行中',
  paused: '已暂停',
  queued: '排队中',
  completed: '已完成',
  cancelled: '已取消',
  unknown: '未知',
};

const STATUS_COLORS: Record<string, string> = {
  blocked: '#f44336',
  failed: '#f44336',
  waiting_approval: '#ff9800',
  running: '#2196f3',
  paused: '#9e9e9e',
  queued: '#9e9e9e',
  completed: '#4caf50',
  cancelled: '#9e9e9e',
  unknown: '#9e9e9e',
};

export interface WorkerCardProps {
  worker: FleetWorkerView;
  onCancel?: (workerId: string) => void;
  onRetry?: (workerId: string) => void;
  onOpenWorktree?: (worker: FleetWorkerView) => void;
}

export function WorkerCard({ worker, onCancel, onRetry, onOpenWorktree }: WorkerCardProps) {
  const [expanded, setExpanded] = useState(false);
  const statusColor = STATUS_COLORS[worker.status] || STATUS_COLORS.unknown;
  const statusLabel = STATUS_LABELS[worker.status] || STATUS_LABELS.unknown;
  const isTerminal = ['completed', 'cancelled', 'failed'].includes(worker.status);

  const handleCancel = () => {
    if (onCancel) onCancel(worker.id);
  };

  const handleRetry = () => {
    if (onRetry) onRetry(worker.id);
  };

  const handleOpen = () => {
    if (onOpenWorktree) onOpenWorktree(worker);
  };

  return (
    <div className={`worker-card worker-card-${worker.status}`}>
      <div className="worker-card-header" onClick={() => setExpanded(!expanded)}>
        <span className="worker-status-dot" style={{ backgroundColor: statusColor }} />
        <span className="worker-id">{worker.id}</span>
        <span className="worker-status-label">{statusLabel}</span>
        <span className="worker-expand-icon">{expanded ? '▾' : '▸'}</span>
      </div>

      {expanded && (
        <div className="worker-card-body">
          {worker.title && (
            <div className="worker-field">
              <span className="worker-field-label">标题:</span>
              <span className="worker-field-value">{worker.title}</span>
            </div>
          )}
          {worker.branch && (
            <div className="worker-field">
              <span className="worker-field-label">分支:</span>
              <span className="worker-field-value worker-mono">{worker.branch}</span>
            </div>
          )}
          {worker.startedAt && (
            <div className="worker-field">
              <span className="worker-field-label">开始:</span>
              <span className="worker-field-value">
                {new Date(worker.startedAt).toLocaleString()}
              </span>
            </div>
          )}

          <div className="worker-actions">
            {worker.status === 'running' && onCancel && (
              <button className="worker-btn worker-btn-cancel" onClick={handleCancel}>
                取消
              </button>
            )}
            {isTerminal && worker.status !== 'cancelled' && onRetry && (
              <button className="worker-btn worker-btn-retry" onClick={handleRetry}>
                重试
              </button>
            )}
            {onOpenWorktree && (
              <button className="worker-btn worker-btn-open" onClick={handleOpen}>
                打开 Worktree
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

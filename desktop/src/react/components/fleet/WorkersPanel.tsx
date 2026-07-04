/**
 * WorkersPanel — GUI 任务指挥台
 *
 * 显示所有 Fleet Worker 状态，支持创建新任务、监控进度。
 * 简化版，专注于核心 UI。
 */

import { useEffect, useState } from 'react';
import { useStore } from '../../stores';
import { WorkerCard } from './WorkerCard';
import { TaskBriefForm } from './TaskBriefForm';
import { sortWorkersByAttention, countByStatus, type FleetWorkerView } from './fleet-sort';

export interface WorkersPanelProps {
  onDispatch?: (brief: { title: string; owned: string; forbidden: string; tests: string; branch: string; worktree: string }) => void;
}

export function WorkersPanel({ onDispatch }: WorkersPanelProps = {}) {
  const activePanel = useStore((s) => s.activePanel);
  const workers = (useStore((s) => (s as any).fleetWorkers) as FleetWorkerView[]) || [];
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    // 加载 Worker 列表
    if (activePanel !== 'fleet') return;
    let alive = true;
    fetch('/api/fleet/workers')
      .then((r) => (r.ok ? r.json() : { workers: [] }))
      .then((d) => {
        if (alive && Array.isArray(d?.workers)) {
          (useStore.setState as any)({ fleetWorkers: d.workers });
        }
      })
      .catch(() => {
        /* route unavailable */
      });
    return () => {
      alive = false;
    };
  }, [activePanel]);

  if (activePanel !== 'fleet') return null;

  const sorted = sortWorkersByAttention(workers);
  const counts = countByStatus(workers);

  const handleDispatch = (brief: any) => {
    fetch('/api/fleet/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(brief),
    })
      .then((r) => r.json())
      .then(() => setShowForm(false))
      .catch(() => {});
    onDispatch?.(brief);
  };

  return (
    <div className="fleet-workers-panel">
      <div className="fleet-header">
        <h2 className="fleet-title">Workers</h2>
        <div className="fleet-stats">
          <span className="fleet-stat fleet-stat-running">运行 {counts.running}</span>
          <span className="fleet-stat fleet-stat-queued">排队 {counts.queued}</span>
          <span className="fleet-stat fleet-stat-blocked">阻塞 {counts.blocked + counts.failed}</span>
        </div>
        <button className="fleet-dispatch-btn" onClick={() => setShowForm(!showForm)}>
          {showForm ? '取消' : '+ 派遣 Worker'}
        </button>
      </div>

      {showForm && (
        <TaskBriefForm
          onSubmit={handleDispatch}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="fleet-workers-list">
        {sorted.length === 0 ? (
          <div className="fleet-empty">
            <p>暂无 Worker 任务</p>
            <p className="fleet-empty-hint">点击"派遣 Worker"创建一个新任务</p>
          </div>
        ) : (
          sorted.map((worker) => <WorkerCard key={worker.id} worker={worker} />)
        )}
      </div>
    </div>
  );
}

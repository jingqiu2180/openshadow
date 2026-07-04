/**
 * fleet-sort.ts — Worker 排序工具
 *
 * 按状态关注度排序，让需要关注的 Worker 浮到顶部。
 * 纯函数。
 */

export type WorkerStatus =
  | 'blocked'
  | 'failed'
  | 'waiting_approval'
  | 'running'
  | 'queued'
  | 'completed'
  | 'cancelled'
  | 'paused'
  | 'unknown';

export interface FleetWorkerView {
  id: string;
  status: WorkerStatus;
  title?: string;
  branch?: string;
  startedAt?: number;
  updatedAt?: number;
  [key: string]: unknown;
}

const ATTENTION_ORDER: Record<string, number> = {
  blocked: 0,
  failed: 1,
  waiting_approval: 2,
  running: 3,
  paused: 4,
  queued: 5,
  completed: 6,
  cancelled: 7,
  unknown: 9,
};

export function sortWorkersByAttention(workers: FleetWorkerView[]): FleetWorkerView[] {
  return workers
    .map((w, i) => ({ w, i }))
    .sort((a, b) => {
      const oa = ATTENTION_ORDER[a.w.status] ?? 9;
      const ob = ATTENTION_ORDER[b.w.status] ?? 9;
      if (oa !== ob) return oa - ob;
      return a.i - b.i;
    })
    .map((x) => x.w);
}

export function countByStatus(workers: FleetWorkerView[]): Record<WorkerStatus, number> {
  const counts: Record<WorkerStatus, number> = {
    blocked: 0,
    failed: 0,
    waiting_approval: 0,
    running: 0,
    queued: 0,
    completed: 0,
    cancelled: 0,
    paused: 0,
    unknown: 0,
  };
  for (const w of workers) {
    counts[w.status] = (counts[w.status] || 0) + 1;
  }
  return counts;
}

export function needsAttention(status: WorkerStatus): boolean {
  return status === 'blocked' || status === 'failed' || status === 'waiting_approval';
}

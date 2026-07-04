/**
 * fleet-reducer.ts — Fleet Worker 状态归约器
 *
 * 处理 Worker 状态转换的纯函数。
 */

import type { FleetWorkerView, WorkerStatus } from './fleet-sort';

export type FleetAction =
  | { type: 'WORKER_CREATED'; worker: FleetWorkerView }
  | { type: 'WORKER_UPDATED'; id: string; patch: Partial<FleetWorkerView> }
  | { type: 'WORKER_REMOVED'; id: string }
  | { type: 'WORKER_STATUS_CHANGED'; id: string; status: WorkerStatus }
  | { type: 'BULK_UPDATE'; workers: FleetWorkerView[] }
  | { type: 'RESET' };

export interface FleetState {
  workers: Record<string, FleetWorkerView>;
  order: string[];
  lastUpdate: number;
}

export const initialFleetState: FleetState = {
  workers: {},
  order: [],
  lastUpdate: 0,
};

export function fleetReducer(state: FleetState, action: FleetAction): FleetState {
  switch (action.type) {
    case 'WORKER_CREATED': {
      const { worker } = action;
      return {
        ...state,
        workers: { ...state.workers, [worker.id]: worker },
        order: state.order.includes(worker.id) ? state.order : [...state.order, worker.id],
        lastUpdate: Date.now(),
      };
    }
    case 'WORKER_UPDATED': {
      const existing = state.workers[action.id];
      if (!existing) return state;
      return {
        ...state,
        workers: {
          ...state.workers,
          [action.id]: { ...existing, ...action.patch, updatedAt: Date.now() },
        },
        lastUpdate: Date.now(),
      };
    }
    case 'WORKER_REMOVED': {
      const { [action.id]: _, ...rest } = state.workers;
      return {
        ...state,
        workers: rest,
        order: state.order.filter((id) => id !== action.id),
        lastUpdate: Date.now(),
      };
    }
    case 'WORKER_STATUS_CHANGED': {
      const existing = state.workers[action.id];
      if (!existing) return state;
      return {
        ...state,
        workers: {
          ...state.workers,
          [action.id]: { ...existing, status: action.status, updatedAt: Date.now() },
        },
        lastUpdate: Date.now(),
      };
    }
    case 'BULK_UPDATE': {
      const workers: Record<string, FleetWorkerView> = {};
      const order: string[] = [];
      for (const w of action.workers) {
        workers[w.id] = w;
        order.push(w.id);
      }
      return { workers, order, lastUpdate: Date.now() };
    }
    case 'RESET':
      return initialFleetState;
    default:
      return state;
  }
}

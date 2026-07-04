/**
 * fleet-conflicts.ts — Fleet 任务冲突检测
 *
 * 检测 Worker 之间的路径冲突、依赖冲突。
 */

export interface FleetTaskScope {
  id: string;
  owned: string[];
  forbidden: string[];
}

export interface FleetConflict {
  type: 'path' | 'branch' | 'worktree';
  taskA: string;
  taskB: string;
  detail: string;
}

export function detectPathConflicts(tasks: FleetTaskScope[]): FleetConflict[] {
  const conflicts: FleetConflict[] = [];

  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const a = tasks[i];
      const b = tasks[j];

      const overlap = findOverlap(a.owned, b.owned);
      if (overlap.length > 0) {
        conflicts.push({
          type: 'path',
          taskA: a.id,
          taskB: b.id,
          detail: `共同拥有路径: ${overlap.join(', ')}`,
        });
      }

      if (pathIsForbidden(a, b.owned) || pathIsForbidden(b, a.owned)) {
        conflicts.push({
          type: 'path',
          taskA: a.id,
          taskB: b.id,
          detail: 'A 拥有的路径在 B 的 forbidden 中（或反之）',
        });
      }
    }
  }

  return conflicts;
}

function findOverlap(ownedA: string[], ownedB: string[]): string[] {
  const overlap: string[] = [];
  for (const a of ownedA) {
    for (const b of ownedB) {
      if (a === b) {
        overlap.push(a);
        break;
      }
      if (a.endsWith('/**') && b.startsWith(a.slice(0, -3))) {
        overlap.push(a);
        break;
      }
      if (b.endsWith('/**') && a.startsWith(b.slice(0, -3))) {
        overlap.push(b);
        break;
      }
    }
  }
  return overlap;
}

function pathIsForbidden(task: FleetTaskScope, ownedByOther: string[]): boolean {
  for (const forbidden of task.forbidden) {
    for (const owned of ownedByOther) {
      if (forbidden === owned) return true;
      if (forbidden.endsWith('/**') && owned.startsWith(forbidden.slice(0, -3))) return true;
      if (owned.endsWith('/**') && forbidden.startsWith(owned.slice(0, -3))) return true;
    }
  }
  return false;
}

export function hasConflict(conflicts: FleetConflict[], taskId: string): boolean {
  return conflicts.some((c) => c.taskA === taskId || c.taskB === taskId);
}

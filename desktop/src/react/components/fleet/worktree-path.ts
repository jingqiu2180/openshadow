/**
 * worktree-path.ts — Worktree 路径生成工具
 *
 * 为 Fleet Worker 生成 worktree 路径，处理冲突和清理。
 */

export interface WorktreeOptions {
  baseDir: string;
  worktreeName: string;
  branchName: string;
  createDir?: boolean;
}

export function buildWorktreePath({ baseDir, worktreeName, branchName }: WorktreeOptions): string {
  const safe = sanitizeName(worktreeName);
  return `${baseDir.replace(/\/+$/, '')}/${safe}`;
}

export function buildBranchName(prefix: string, title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `${prefix.replace(/\/+$/, '')}/${slug || 'task'}`;
}

export function sanitizeName(name: string): string {
  return name
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function ensureUniquePath(basePath: string, existing: string[]): string {
  if (!existing.includes(basePath)) return basePath;

  let counter = 2;
  let candidate = `${basePath}-${counter}`;
  while (existing.includes(candidate)) {
    counter++;
    candidate = `${basePath}-${counter}`;
  }
  return candidate;
}

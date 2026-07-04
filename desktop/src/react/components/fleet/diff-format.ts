/**
 * diff-format.ts — Diff 格式化工具
 *
 * 解析和格式化 unified diff，提供摘要和文件级统计。
 */

export interface DiffFileStats {
  filePath: string;
  linesAdded: number;
  linesRemoved: number;
  isBinary: boolean;
  isNew: boolean;
  isDeleted: boolean;
  isRenamed: boolean;
}

export function parseDiffHeader(diff: string): string[] {
  const files: string[] = [];
  const lines = diff.split('\n');
  for (const line of lines) {
    if (line.startsWith('+++ b/') || line.startsWith('+++ ')) {
      const path = line.replace(/^\+\+\+ [ab]?\/?/, '').trim();
      if (path && path !== '/dev/null') files.push(path);
    }
  }
  return files;
}

export function summarizeDiff(diff: string): { added: number; removed: number; files: string[] } {
  let added = 0;
  let removed = 0;
  const files = new Set<string>();

  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ b/') || line.startsWith('+++ ')) {
      const path = line.replace(/^\+\+\+ [ab]?\/?/, '').trim();
      if (path && path !== '/dev/null') files.add(path);
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      added++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      removed++;
    }
  }

  return { added, removed, files: Array.from(files) };
}

export function formatDiffStats(stats: DiffFileStats): string {
  const parts: string[] = [];
  parts.push(`+${stats.linesAdded}`);
  parts.push(`-${stats.linesRemoved}`);
  if (stats.isNew) parts.push('new');
  if (stats.isDeleted) parts.push('deleted');
  if (stats.isRenamed) parts.push('renamed');
  if (stats.isBinary) parts.push('binary');
  return parts.join(' · ');
}

export function diffPath(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1] || filePath;
}

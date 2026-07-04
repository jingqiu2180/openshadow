/**
 * DiffViewer — 轻量级 unified diff 内联展示
 *
 * 解析 unified diff 格式，渲染绿色增/红色删行。
 * 支持折叠/展开和 Accept/Reject 操作。
 */

import { memo, useState, useCallback, useMemo } from 'react';

interface Props {
  filePath: string;
  diff: string;
  linesAdded: number;
  linesRemoved: number;
  rollbackId?: string;
  maximized?: boolean;
}

interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'header';
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

function parseDiff(diff: string): DiffLine[] {
  const lines = diff.split('\n');
  const result: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
      }
      result.push({ type: 'header', content: line });
    } else if (line.startsWith('---') || line.startsWith('+++')) {
      continue;
    } else if (line.startsWith('+')) {
      result.push({ type: 'add', content: line.slice(1), newLineNum: newLine });
      newLine++;
    } else if (line.startsWith('-')) {
      result.push({ type: 'remove', content: line.slice(1), oldLineNum: oldLine });
      oldLine++;
    } else if (line.startsWith(' ')) {
      result.push({ type: 'context', content: line.slice(1), oldLineNum: oldLine, newLineNum: newLine });
      oldLine++;
      newLine++;
    }
  }
  return result;
}

function getFileName(filePath: string): string {
  return filePath.split('/').pop() || filePath;
}

export const DiffViewer = memo(function DiffViewer({ filePath, diff, linesAdded, linesRemoved, rollbackId, maximized }: Props) {
  const isZh = String(document?.documentElement?.lang || '').startsWith('zh');
  const [expanded, setExpanded] = useState(true);
  const [status, setStatus] = useState<'pending' | 'accepted' | 'rejected'>('pending');
  const [isRejecting, setIsRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsedLines = useMemo(() => parseDiff(diff), [diff]);

  const toggle = useCallback(() => setExpanded((v) => !v), []);

  const handleAccept = useCallback(() => {
    setError(null);
    setStatus('accepted');
  }, []);

  const handleReject = useCallback(async () => {
    if (!rollbackId || isRejecting) return;

    setIsRejecting(true);
    setError(null);
    try {
      const res = await fetch('/api/fs/revert-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollbackId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus('rejected');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      setError(raw || (isZh ? '回滚失败' : 'Rollback failed'));
    } finally {
      setIsRejecting(false);
    }
  }, [isRejecting, isZh, rollbackId]);

  const fileName = getFileName(filePath);
  const rejectDisabled = !rollbackId || isRejecting;

  return (
    <div className="diff-card" data-status={status}>
      <div className="diff-header" onClick={toggle}>
        <div className="diff-file-info">
          <span className="diff-file-name">{fileName}</span>
          <span className="diff-file-path" title={filePath}>{filePath}</span>
        </div>
        <div className="diff-stats">
          {linesAdded > 0 && <span className="diff-stats-added">+{linesAdded}</span>}
          {linesRemoved > 0 && <span className="diff-stats-removed">-{linesRemoved}</span>}
          <span className="diff-toggle-arrow">{expanded ? '▾' : '▸'}</span>
        </div>
      </div>
      {expanded && (
        <div className={`diff-body${maximized ? ' diff-body-max' : ''}`}>
          <div className="diff-lines">
            {parsedLines.map((line, i) => (
              <div
                key={i}
                className={`diff-line diff-line-${line.type}`}
              >
                <span className="diff-line-num">
                  {line.type === 'header' ? '' : (line.oldLineNum ?? '')}
                </span>
                <span className="diff-line-num">
                  {line.type === 'header' ? '' : (line.newLineNum ?? '')}
                </span>
                <span className="diff-line-prefix">
                  {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : line.type === 'header' ? '' : ' '}
                </span>
                <span className="diff-line-content">{line.content}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {status === 'pending' && (
        <div className="diff-actions">
          <button className="diff-accept-btn" onClick={handleAccept}>
            {isZh ? '✓ 接受改动' : '✓ Accept'}
          </button>
          <button
            className="diff-reject-btn"
            onClick={handleReject}
            disabled={rejectDisabled}
          >
            {isRejecting
              ? (isZh ? '… 正在回滚' : '… Reverting')
              : (isZh ? '✗ 放弃改动' : '✗ Reject')}
          </button>
        </div>
      )}
      {status !== 'pending' && (
        <div className={`diff-status-bar diff-status-${status}`}>
          {status === 'accepted'
            ? (isZh ? '✓ 已接受改动' : '✓ Accepted')
            : (isZh ? '✗ 已放弃改动' : '✗ Rejected')}
        </div>
      )}
      {error && <div className="diff-error">{error}</div>}
    </div>
  );
});

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

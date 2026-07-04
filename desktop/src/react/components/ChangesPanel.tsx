/**
 * ChangesPanel — 代码变更面板
 *
 * 显示当前 session 的文件变更，支持查看 diff 和回滚。
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useStore } from '../stores';
import { DiffViewer } from '../components/chat/DiffViewer';

interface ChangeFile {
  filePath: string;
  linesAdded: number;
  linesRemoved: number;
  rollbackId?: string | null;
  source: 'session' | 'git';
  diff?: string;
}

export function ChangesPanel() {
  const activePanel = useStore((s) => s.activePanel);
  const setActivePanel = useStore((s) => s.setActivePanel);
  const [changes, setChanges] = useState<ChangeFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDiff, setSelectedDiff] = useState<string | null>(null);
  const zh = String(document?.documentElement?.lang || '').startsWith('zh');

  // 只在 Changes panel 激活时显示
  if (activePanel !== 'changes') return null;

  const loadChanges = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/fs/changes', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setChanges(data.files || []);
      }
    } catch (err) {
      console.error('Failed to load changes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChanges();
  }, [loadChanges]);

  const handleClose = () => {
    setActivePanel(null);
  };

  return (
    <div className="changes-panel">
      <div className="changes-panel-header">
        <span className="changes-panel-title">
          {zh ? '代码变更' : 'Changes'}
        </span>
        <button className="changes-panel-close" onClick={handleClose}>×</button>
      </div>
      <div className="changes-panel-body">
        {loading ? (
          <div className="changes-loading">{zh ? '加载中...' : 'Loading...'}</div>
        ) : changes.length === 0 ? (
          <div className="changes-empty">{zh ? '没有变更' : 'No changes'}</div>
        ) : (
          <div className="changes-list">
            {changes.map((file) => (
              <div key={file.filePath} className="change-file-item">
                <div className="change-file-header" onClick={() => setSelectedDiff(selectedDiff === file.filePath ? null : file.filePath)}>
                  <span className="change-file-name">{file.filePath.split('/').pop()}</span>
                  <span className="change-file-path">{file.filePath}</span>
                  <span className="change-file-stats">
                    {file.linesAdded > 0 && <span className="lines-added">+{file.linesAdded}</span>}
                    {file.linesRemoved > 0 && <span className="lines-removed">-{file.linesRemoved}</span>}
                  </span>
                </div>
                {selectedDiff === file.filePath && file.diff && (
                  <div className="change-file-diff">
                    <DiffViewer
                      filePath={file.filePath}
                      diff={file.diff}
                      linesAdded={file.linesAdded}
                      linesRemoved={file.linesRemoved}
                      rollbackId={file.rollbackId || undefined}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

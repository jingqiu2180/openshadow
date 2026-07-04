/**
 * ApplyCodeDialog — 代码块 Apply 弹窗
 *
 * 点击 Apply 按钮后弹出，选择/输入文件路径，一键写入。
 */

import { useState, useCallback, useRef, useEffect } from 'react';

interface Props {
  code: string;
  language?: string;
  onClose: () => void;
  anchorRect?: DOMRect;
}

export function ApplyCodeDialog({ code, language, onClose, anchorRect }: Props) {
  const [filePath, setFilePath] = useState('');
  const [status, setStatus] = useState<'idle' | 'applying' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 猜测文件扩展名
  const ext = language ? `.${language}` : '';

  const handleApply = useCallback(async () => {
    const path = filePath.trim();
    if (!path) return;
    setStatus('applying');
    try {
      const res = await fetch('/api/fs/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: path, content: code }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setStatus('success');
      setTimeout(onClose, 1200);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Failed to apply');
      setStatus('error');
    }
  }, [filePath, code, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApply();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [handleApply, onClose]);

  // 关闭背景点击
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const isZh = String(document?.documentElement?.lang || '').startsWith('zh');

  return (
    <div className="apply-dialog-backdrop" onClick={handleBackdropClick}>
      <div className="apply-dialog" style={anchorRect ? {
        position: 'fixed',
        top: Math.min(anchorRect.bottom + 4, window.innerHeight - 180),
        left: Math.min(anchorRect.left, window.innerWidth - 340),
      } : undefined}>
        <div className="apply-dialog-header">
          <span className="apply-dialog-title">{isZh ? '应用到文件' : 'Apply to file'}</span>
          <button className="apply-dialog-close" onClick={onClose}>×</button>
        </div>
        <div className="apply-dialog-body">
          <input
            ref={inputRef}
            className="apply-dialog-input"
            type="text"
            placeholder={`${isZh ? '文件路径' : 'File path'}${ext ? ` (e.g. ./file${ext})` : '...'}`}
            value={filePath}
            onChange={e => setFilePath(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={status === 'applying' || status === 'success'}
          />
          {status === 'error' && <div className="apply-dialog-error">{errorMsg}</div>}
          {status === 'success' && <div className="apply-dialog-success">{isZh ? '✓ 应用成功' : '✓ Applied successfully'}</div>}
        </div>
        <div className="apply-dialog-footer">
          <button className="apply-dialog-cancel" onClick={onClose}>{isZh ? '取消' : 'Cancel'}</button>
          <button
            className="apply-dialog-apply"
            onClick={handleApply}
            disabled={!filePath.trim() || status === 'applying' || status === 'success'}
          >
            {status === 'applying' ? (isZh ? '应用中...' : 'Applying...') : (isZh ? '应用' : 'Apply')}
          </button>
        </div>
      </div>
    </div>
  );
}

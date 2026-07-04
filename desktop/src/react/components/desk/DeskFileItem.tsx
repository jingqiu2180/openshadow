/**
 * DeskFileItem — 书桌文件列表中的单个条目（简化版）
 */

import { useCallback } from 'react';
import { useStore } from '../../stores';
import type { DeskFile } from '../../types';

export interface DeskFileItemProps {
  file: DeskFile;
  selected: boolean;
  onSelect: (name: string, multi: boolean) => void;
}

export function DeskFileItem({ file, selected, onSelect }: DeskFileItemProps) {
  const t = window.t ?? ((key: string) => key);
  const deskCurrentPath = useStore((s) => s.deskCurrentPath);

  const handleClick = useCallback((e: React.MouseEvent) => {
    onSelect(file.name, e.metaKey || e.ctrlKey);
  }, [file.name, onSelect]);

  const handleDoubleClick = useCallback(() => {
    if (file.isDir) {
      // Navigate to folder
      const newPath = deskCurrentPath ? `${deskCurrentPath}/${file.name}` : file.name;
      useStore.setState({ deskCurrentPath: newPath });
    } else {
      // Open file — construct full path
      const fullPath = deskCurrentPath ? `${deskCurrentPath}/${file.name}` : file.name;
      window.platform?.openExternal?.(fullPath);
    }
  }, [file, deskCurrentPath]);

  return (
    <div
      className={`desk-file-item${selected ? ' selected' : ''}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <span className="desk-file-icon">
        {file.isDir ? '📁' : '📄'}
      </span>
      <span className="desk-file-name">{file.name}</span>
      {file.size != null && (
        <span className="desk-file-size">{formatSize(file.size)}</span>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

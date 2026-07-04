/**
 * DeskFileList — 书桌文件列表（简化版）
 */

import { useCallback, useState } from 'react';
import { useStore } from '../../stores';
import { DeskFileItem } from './DeskFileItem';

export function DeskFileList() {
  const deskFiles = useStore(s => s.deskFiles);
  const deskCurrentPath = useStore(s => s.deskCurrentPath);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const handleSelect = useCallback((name: string, multi: boolean) => {
    setSelectedFiles(prev => {
      if (multi) {
        const next = new Set(prev);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        return next;
      }
      return new Set([name]);
    });
  }, []);

  if (!deskFiles || deskFiles.length === 0) {
    return (
      <div className="desk-file-list-empty">
        <p>{window.t?.('desk.empty') || 'No files'}</p>
      </div>
    );
  }

  return (
    <div className="desk-file-list">
      {deskFiles.map(file => (
        <DeskFileItem
          key={file.name}
          file={file}
          selected={selectedFiles.has(file.name)}
          onSelect={handleSelect}
        />
      ))}
    </div>
  );
}

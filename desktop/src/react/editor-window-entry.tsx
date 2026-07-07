/**
 * editor-window-entry.ts — Editor Window 入口
 * 
 * 独立编辑器窗口的 React 入口点
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { ArtifactEditor, type ArtifactEditorHandle } from './components/ArtifactEditor';
import './editor-window.css';

function getQueryParam(name: string): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function EditorWindowApp() {
  const filePath = getQueryParam('file');
  const mode = (getQueryParam('mode') as 'markdown' | 'code' | 'text') || 'markdown';
  const [content, setContent] = React.useState<string>('');
  const [loading, setLoading] = React.useState(true);
  const editorRef = React.useRef<ArtifactEditorHandle>(null);

  React.useEffect(() => {
    if (!filePath) {
      setLoading(false);
      return;
    }

    // 读取文件内容
    window.platform?.readFile(filePath).then((text: string | null) => {
      setContent(text || '');
      setLoading(false);
    }).catch(() => {
      setContent('');
      setLoading(false);
    });
  }, [filePath]);

  const handleDock = () => {
    // 通知主窗口 dock 编辑器
    window.postMessage({
      type: 'editor-dock',
      filePath,
    }, '*');
  };

  const handleClose = () => {
    window.close();
  };

  if (loading) {
    return <div className="editor-loading">Loading...</div>;
  }

  return (
    <div className="editor-window-container">
      <div className="editor-toolbar">
        <div className="toolbar-drag">
          <span className="toolbar-title">
            {filePath ? filePath.split('/').pop() : 'Untitled'}
          </span>
        </div>
        <button className="tb-btn" onClick={handleDock} title="Dock to panel">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="5" x2="5" y2="19"></line>
            <polyline points="5 9 5 19 15 19"></polyline>
          </svg>
        </button>
        <button className="tb-btn" onClick={handleClose} title="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div className="editor-body">
        <ArtifactEditor
          ref={editorRef}
          content={content}
          filePath={filePath || undefined}
          mode={mode}
        />
      </div>
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<EditorWindowApp />);
}

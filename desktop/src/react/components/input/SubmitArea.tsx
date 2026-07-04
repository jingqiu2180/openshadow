/**
 * SubmitArea — 提交按钮区域
 *
 * 输入框下方的操作区：附件、模型选择、发送按钮等。
 */

import { useState } from 'react';

export interface SubmitAreaProps {
  busy: boolean;
  canSend: boolean;
  onSend: () => void;
  onStop?: () => void;
  onAttach?: () => void;
  attachedCount?: number;
  showModelSelector?: boolean;
  currentModel?: string;
  onModelChange?: (model: string) => void;
  availableModels?: { id: string; label: string }[];
  placeholder?: string;
}

export function SubmitArea({
  busy,
  canSend,
  onSend,
  onStop,
  onAttach,
  attachedCount = 0,
  showModelSelector = false,
  currentModel,
  onModelChange,
  availableModels = [],
  placeholder = '输入消息…',
}: SubmitAreaProps) {
  const [modelOpen, setModelOpen] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend && !busy) onSend();
    }
  };

  return (
    <div className="submit-area">
      <div className="submit-area-left">
        {onAttach && (
          <button
            className="submit-attach-btn"
            onClick={onAttach}
            title="添加附件"
          >
            📎 {attachedCount > 0 && <span className="submit-attach-count">{attachedCount}</span>}
          </button>
        )}
        {showModelSelector && availableModels.length > 0 && (
          <div className="submit-model-selector">
            <button
              className="submit-model-btn"
              onClick={() => setModelOpen(!modelOpen)}
            >
              {currentModel || '选择模型'} ▾
            </button>
            {modelOpen && (
              <div className="submit-model-menu">
                {availableModels.map((m) => (
                  <div
                    key={m.id}
                    className={`submit-model-item ${m.id === currentModel ? 'active' : ''}`}
                    onClick={() => {
                      onModelChange?.(m.id);
                      setModelOpen(false);
                    }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <input
        type="text"
        className="submit-text-input"
        placeholder={placeholder}
        onKeyDown={handleKeyDown}
      />

      <div className="submit-area-right">
        {busy && onStop ? (
          <button className="submit-stop-btn" onClick={onStop}>
            ■ 停止
          </button>
        ) : (
          <button
            className="submit-send-btn"
            onClick={onSend}
            disabled={!canSend || busy}
          >
            发送 ⏎
          </button>
        )}
      </div>
    </div>
  );
}

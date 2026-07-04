/**
 * DeepResearchPanel — 深度研究面板
 *
 * 触发深度研究流程的浮层：填入模板、显示进度、显示错误。
 */

export interface DeepResearchPanelProps {
  visible: boolean;
  busy: boolean;
  isStreaming: boolean;
  onClose: () => void;
  onFillTemplate: () => void;
  onStart: () => void | Promise<void>;
}

export function DeepResearchPanel({
  visible,
  busy,
  isStreaming,
  onClose,
  onFillTemplate,
  onStart,
}: DeepResearchPanelProps) {
  if (!visible) return null;

  const handleStart = async () => {
    try {
      await onStart();
    } catch (err) {
      // 错误由父组件处理
    }
  };

  return (
    <div className="deep-research-panel">
      <div className="deep-research-header">
        <h3>深度研究</h3>
        <button className="deep-research-close" onClick={onClose}>×</button>
      </div>

      <div className="deep-research-body">
        <p className="deep-research-desc">
          深度研究会进行多轮搜索、阅读和分析，适合复杂问题的研究。
        </p>

        <div className="deep-research-tips">
          <div className="deep-research-tip-title">使用建议：</div>
          <ul>
            <li>问题尽量具体、明确目标</li>
            <li>可以指定资料范围或时间窗口</li>
            <li>研究结果会自动整理成报告</li>
          </ul>
        </div>

        {busy && (
          <div className="deep-research-progress">
            <div className="deep-research-spinner" />
            <span>{isStreaming ? '正在生成报告…' : '正在研究…'}</span>
          </div>
        )}
      </div>

      <div className="deep-research-actions">
        <button
          className="deep-research-btn deep-research-btn-secondary"
          onClick={onFillTemplate}
          disabled={busy}
        >
          填入模板
        </button>
        <button
          className="deep-research-btn deep-research-btn-primary"
          onClick={handleStart}
          disabled={busy}
        >
          {busy ? '进行中…' : '开始研究'}
        </button>
      </div>
    </div>
  );
}

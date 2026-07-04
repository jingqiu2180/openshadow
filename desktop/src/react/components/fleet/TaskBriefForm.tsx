/**
 * TaskBriefForm — 派遣 Worker 任务表单
 *
 * 让用户创建新的 Fleet 任务：标题、范围、禁止路径、测试命令、worktree 配置。
 * 提交后调用 onSubmit 回调，父组件负责实际派发。
 */

import { useState, useEffect } from 'react';
import {
  FLEET_SCOPE_PRESETS,
  DEFAULT_FLEET_SCOPE_PRESET,
  buildPresetDefaults,
  findPresetById,
  type FleetScopePreset,
} from './brief-presets';

export interface TaskBriefData {
  title: string;
  owned: string;
  forbidden: string;
  tests: string;
  branch: string;
  worktree: string;
  presetId: string;
}

export interface TaskBriefFormProps {
  onSubmit: (data: TaskBriefData) => void;
  onCancel: () => void;
  initialTitle?: string;
}

export function TaskBriefForm({ onSubmit, onCancel, initialTitle = '' }: TaskBriefFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [presetId, setPresetId] = useState<string>(DEFAULT_FLEET_SCOPE_PRESET.id);
  const [owned, setOwned] = useState('');
  const [forbidden, setForbidden] = useState('');
  const [tests, setTests] = useState('');
  const [branch, setBranch] = useState('');
  const [worktree, setWorktree] = useState('');

  // 当 preset 或 title 变化时，重新计算默认值
  useEffect(() => {
    const preset = findPresetById(presetId);
    if (!preset) return;
    const defaults = buildPresetDefaults(preset, title);
    setOwned(defaults.owned);
    setForbidden(defaults.forbidden);
    setTests(defaults.tests);
    setBranch(defaults.branch);
    setWorktree(defaults.worktree);
  }, [presetId, title]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      owned,
      forbidden,
      tests,
      branch,
      worktree,
      presetId,
    });
  };

  return (
    <form className="task-brief-form" onSubmit={handleSubmit}>
      <div className="task-brief-header">
        <h3>派遣 Worker</h3>
        <button type="button" className="task-brief-close" onClick={onCancel}>×</button>
      </div>

      <div className="task-brief-row">
        <label className="task-brief-label">任务标题</label>
        <input
          type="text"
          className="task-brief-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例如：实现批量删除功能"
          required
          autoFocus
        />
      </div>

      <div className="task-brief-row">
        <label className="task-brief-label">任务范围 Preset</label>
        <select
          className="task-brief-select"
          value={presetId}
          onChange={(e) => setPresetId(e.target.value)}
        >
          {FLEET_SCOPE_PRESETS.map((preset: FleetScopePreset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label} — {preset.description}
            </option>
          ))}
        </select>
      </div>

      <div className="task-brief-row">
        <label className="task-brief-label">拥有路径（每行一个）</label>
        <textarea
          className="task-brief-textarea"
          value={owned}
          onChange={(e) => setOwned(e.target.value)}
          rows={3}
        />
      </div>

      <div className="task-brief-row">
        <label className="task-brief-label">禁止路径（每行一个）</label>
        <textarea
          className="task-brief-textarea"
          value={forbidden}
          onChange={(e) => setForbidden(e.target.value)}
          rows={3}
        />
      </div>

      <div className="task-brief-row">
        <label className="task-brief-label">测试命令（每行一个）</label>
        <textarea
          className="task-brief-textarea"
          value={tests}
          onChange={(e) => setTests(e.target.value)}
          rows={2}
        />
      </div>

      <div className="task-brief-row task-brief-row-double">
        <div>
          <label className="task-brief-label">分支名</label>
          <input
            type="text"
            className="task-brief-input task-brief-mono"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
          />
        </div>
        <div>
          <label className="task-brief-label">Worktree 路径</label>
          <input
            type="text"
            className="task-brief-input task-brief-mono"
            value={worktree}
            onChange={(e) => setWorktree(e.target.value)}
          />
        </div>
      </div>

      <div className="task-brief-actions">
        <button type="button" className="task-brief-btn task-brief-btn-cancel" onClick={onCancel}>
          取消
        </button>
        <button type="submit" className="task-brief-btn task-brief-btn-submit">
          派遣
        </button>
      </div>
    </form>
  );
}

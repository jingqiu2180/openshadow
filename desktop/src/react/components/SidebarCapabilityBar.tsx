import { useCallback, useState } from 'react';
import { useStore } from '../stores';
import type { Model } from '../types';
import styles from './SidebarCapabilityBar.module.css';

function formatCompactModelLabel(model: { id: string; provider?: string } | null, _opts?: { role?: string; purpose?: string }): string {
  if (!model) return '';
  return model.id;
}

function getModelTags(model: Model | undefined): string[] {
  const tags: string[] = [];
  if (!model) return tags;
  if (model.reasoning) tags.push('推理');
  if (model.input?.includes('image')) tags.push('视觉');
  if (model.audio) tags.push('音频');
  if (!model.reasoning && tags.length === 0) tags.push('通用');
  return tags;
}

function joinSummary(parts: string[]) {
  return parts.filter(Boolean).join('、');
}

export function SidebarCapabilityBar() {
  const tt = useCallback((key: string, fallback: string) => {
    const value = window.t ? window.t(key) : key;
    return !value || value === key ? fallback : value;
  }, []);
  const currentAgentId = useStore((s) => s.currentAgentId);
  const agentName = useStore((s) => s.agentName) || 'OpenShadow';
  const agentYuan = useStore((s) => s.agentYuan) || 'openshadow';
  const [expanded, setExpanded] = useState(false);
  const models = useStore((s) => s.models);
  const currentModel = useStore((s) => s.currentModel);

  const currentModelName = formatCompactModelLabel(currentModel)
    || models.find((model) => model.id === currentModel?.id)?.name
    || tt('input.embeddedModel.name', '默认模型');

  const currentModelObj = models.find((m) =>
    m.id === currentModel?.id && m.provider === currentModel?.provider,
  ) || models[0] || null;

  const modelTags = getModelTags(currentModelObj);

  const openSkillsPanel = useCallback(() => {
    useStore.setState({ welcomeVisible: false, skillViewerData: null });
    window.dispatchEvent(new CustomEvent('open-skills-panel'));
  }, []);

  const openAutomationPanel = useCallback(() => {
    useStore.setState({
      welcomeVisible: false,
      activePanel: 'automation',
    });
  }, []);

  const openChangesPanel = useCallback(() => {
    useStore.setState({ welcomeVisible: false, activePanel: 'changes' });
  }, []);

  const openFleetPanel = useCallback(() => {
    useStore.setState({ welcomeVisible: false, activePanel: 'fleet' });
  }, []);

  const summary = joinSummary([
    tt('sidebar.capability.web', '会搜网页'),
    tt('sidebar.capability.files', '改文件'),
    tt('sidebar.capability.shell', '跑命令'),
  ]);

  const chips = [
    {
      key: 'skills',
      label: tt('sidebar.capability.skillsCenter', '技能中心'),
      onClick: openSkillsPanel,
    },
    {
      key: 'automation',
      label: tt('sidebar.capability.automation', '自动任务'),
      onClick: openAutomationPanel,
    },
    {
      key: 'fleet',
      label: tt('sidebar.capability.fleet', 'Workers'),
      onClick: openFleetPanel,
    },
    {
      key: 'changes',
      label: tt('sidebar.capability.changes', '改动'),
      onClick: openChangesPanel,
    },
  ].filter(Boolean) as Array<{ key: string; label: string; onClick?: () => void }>;

  return (
    <div className={styles.bar}>
      <div className={styles.name} onClick={() => setExpanded(!expanded)} role="button" tabIndex={0}>
        {agentName}
        <span className={`${styles.expandArrow}${expanded ? ` ${styles.expanded}` : ''}`}>▾</span>
      </div>
      <div className={styles.summary}>{summary}</div>
      <div className={styles.state}>
        <div className={styles.stateLine}>
          <span className={styles.stateLabel}>{tt('sidebar.capability.model', '模型')}</span>
          <span>
            {currentModelName}
            {modelTags.length > 0 && (
              <span className={styles.modelTags}>
                {modelTags.map((tag) => (
                  <span key={tag} className={styles.modelTag}>{tag}</span>
                ))}
              </span>
            )}
          </span>
        </div>
      </div>
      <div className={styles.chips}>
        {chips.map((chip) => (
          chip.onClick ? (
            <button
              key={chip.key}
              type="button"
              className={`${styles.chip} ${styles.chipButton}`}
              onClick={chip.onClick}
            >
              {chip.label}
            </button>
          ) : (
            <span key={chip.key} className={styles.chip}>{chip.label}</span>
          )
        ))}
      </div>
    </div>
  );
}

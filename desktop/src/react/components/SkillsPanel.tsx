import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../stores';
import { hanaFetch } from '../hooks/use-hana-fetch';
import { usePanel } from '../hooks/use-panel';
import type { SkillInfo } from '../settings/store';
import fp from './FloatingPanels.module.css';
import styles from './SkillsPanel.module.css';

const ALL_SKILLS_TAB = '__all_skills__';

type Translator = (key: string, params?: Record<string, string | number>) => string;
const fallbackTranslator: Translator = (key: string) => key;

export function SkillsPanel() {
  const agents = useStore(s => s.agents);
  const currentAgentId = useStore(s => s.currentAgentId);
  const addToast = useStore(s => s.addToast);
  const t = useCallback<Translator>((key, params) => {
    const translate = (window.t ?? fallbackTranslator) as Translator;
    return translate(key, params);
  }, []);

  const [selectedTabId, setSelectedTabId] = useState<string>(ALL_SKILLS_TAB);
  const [skillsList, setSkillsList] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const skillFileInputRef = useState<HTMLInputElement | null>(null);
  const fileInputRef = useState<HTMLInputElement | null>(null);

  const { visible, close } = usePanel('skills');

  const selectedAgentId = selectedTabId === ALL_SKILLS_TAB ? currentAgentId : selectedTabId;

  const loadSkills = useCallback(async (agentId: string | null) => {
    if (!agentId) {
      setSkillsList([]);
      return;
    }
    setLoading(true);
    try {
      const res = await hanaFetch(`/api/skills?agentId=${encodeURIComponent(agentId)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSkillsList(data.skills || []);
    } catch (err) {
      console.error('[skills-panel] load failed:', err);
      addToast(t('settings.saveFailed') + ': ' + (err instanceof Error ? err.message : String(err)), 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, t]);

  useEffect(() => {
    if (!visible) return;
    void loadSkills(selectedAgentId);
  }, [loadSkills, selectedAgentId, visible]);

  const installSkill = useCallback(async () => {
    // 触发文件选择
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,.skill,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const agentId = selectedAgentId || currentAgentId;
      if (!agentId) {
        addToast('No agent selected', 'error');
        return;
      }
      try {
        const contentBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(reader.error);
          reader.onload = () => {
            const result = String(reader.result || '');
            resolve(result.includes(',') ? result.split(',').pop() || '' : result);
          };
          reader.readAsDataURL(file);
        });
        const res = await hanaFetch(`/api/skills/install?agentId=${encodeURIComponent(agentId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file: { filename: file.name, contentBase64 },
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        addToast(t('settings.skills.installSuccess', { name: file.name }), 'success');
        await loadSkills(agentId);
      } catch (err) {
        addToast(t('settings.skills.installError') + ': ' + (err instanceof Error ? err.message : String(err)), 'error');
      }
    };
    input.click();
  }, [addToast, currentAgentId, loadSkills, selectedAgentId, t]);

  const toggleSkill = useCallback(async (name: string, enable: boolean) => {
    const agentId = selectedAgentId || currentAgentId;
    if (!agentId) return;
    try {
      const res = await hanaFetch(`/api/agents/${encodeURIComponent(agentId)}/skills/${encodeURIComponent(name)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: enable }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await loadSkills(agentId);
      addToast(t('settings.autoSaved'), 'success');
    } catch (err) {
      addToast(t('settings.saveFailed') + ': ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  }, [addToast, currentAgentId, loadSkills, selectedAgentId, t]);

  const deleteSkill = useCallback(async (name: string) => {
    const agentId = selectedAgentId || currentAgentId;
    if (!agentId) return;
    if (!confirm(t('settings.skills.deleteConfirm', { name }))) return;
    try {
      const res = await hanaFetch(`/api/skills/${encodeURIComponent(name)}?agentId=${encodeURIComponent(agentId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await loadSkills(agentId);
      addToast(t('settings.autoSaved'), 'success');
    } catch (err) {
      addToast(t('settings.saveFailed') + ': ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  }, [addToast, currentAgentId, loadSkills, selectedAgentId, t]);

  if (!visible) return null;

  const visibleSkills = skillsList.filter(s => !s.hidden);

  return (
    <div className={fp.floatingPanel} id="skillsPanel">
      <div className={fp.floatingPanelInner}>
        <div className={fp.floatingPanelHeader}>
          <h2 className={fp.floatingPanelTitle}>{t('skills.panel.title')}</h2>
          <button className={fp.floatingPanelClose} onClick={close} aria-label={t('common.close')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className={fp.floatingPanelBody}>
          <div
            className={styles.dropSurface}
            data-drag-over={dragOver ? 'true' : undefined}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) {
                // Handle file drop - install skill
                installSkill();
              }
            }}
          >
            {/* Agent tabs */}
            <div className={styles.agentTabs}>
              <button
                className={`${styles.agentTab}${selectedTabId === ALL_SKILLS_TAB ? ` ${styles.active}` : ''}`}
                onClick={() => setSelectedTabId(ALL_SKILLS_TAB)}
              >
                {t('skills.panel.allTab')}
              </button>
              {agents.map(agent => (
                <button
                  key={agent.id}
                  className={`${styles.agentTab}${selectedTabId === agent.id ? ` ${styles.active}` : ''}`}
                  onClick={() => setSelectedTabId(agent.id)}
                >
                  {agent.name}
                </button>
              ))}
            </div>

            {/* Install button */}
            <button className={styles.installBtn} onClick={installSkill}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {t('settings.skills.install')}
            </button>

            {/* Skills list */}
            {loading ? (
              <div className={styles.empty}>{t('status.loading')}</div>
            ) : visibleSkills.length === 0 ? (
              <div className={styles.empty}>{t('settings.skills.noUser')}</div>
            ) : (
              <div className={styles.skillsList}>
                {visibleSkills.map(skill => (
                  <div key={skill.name} className={styles.skillItem}>
                    <label className={styles.skillLabel}>
                      <input
                        type="checkbox"
                        checked={skill.enabled}
                        onChange={(e) => toggleSkill(skill.name, e.target.checked)}
                      />
                      <span className={styles.skillName}>{skill.name}</span>
                    </label>
                    {!skill.readonly && (
                      <button
                        className={styles.deleteBtn}
                        onClick={() => deleteSkill(skill.name)}
                        title={t('common.delete')}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

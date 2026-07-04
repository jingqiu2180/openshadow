/**
 * brief-presets.ts — Fleet 任务简报预设配置
 *
 * 预定义不同范围的 Worker 任务范围、禁止路径、测试命令。
 * 纯数据，没有副作用。
 */

export interface FleetScopePreset {
  id: string;
  label: string;
  description: string;
  owned: string[];
  forbidden: string[];
  tests: string[];
  branchPrefix: string;
  worktreePrefix: string;
}

export interface FleetBriefDefaults {
  owned: string;
  forbidden: string;
  tests: string;
  branch: string;
  worktree: string;
}

export const FLEET_SCOPE_PRESETS: FleetScopePreset[] = [
  {
    id: 'desktop-ui',
    label: 'Desktop UI',
    description: 'Renderer 组件与 UX 优化（不含 Fleet 协议）',
    owned: ['desktop/src/react/**'],
    forbidden: ['server/**', 'core/**', 'cli/**'],
    tests: ['npm run typecheck', 'npm run build:renderer'],
    branchPrefix: 'fleet/ui',
    worktreePrefix: 'worktrees/fleet-ui',
  },
  {
    id: 'gui-fleet',
    label: 'GUI Fleet',
    description: 'Workers panel, fleet store, server Fleet route',
    owned: [
      'desktop/src/react/components/fleet/**',
      'desktop/src/react/stores/fleet-slice.ts',
      'server/routes/fleet.ts',
    ],
    forbidden: ['cli/**', 'server/routes/chat.ts', 'core/engine.ts'],
    tests: ['npm run typecheck', 'npm run build:renderer'],
    branchPrefix: 'fleet/gui',
    worktreePrefix: 'worktrees/fleet-gui',
  },
  {
    id: 'server-safe',
    label: 'Server safe refactor',
    description: '小范围 server 模块；核心文件锁定',
    owned: ['server/**'],
    forbidden: ['server/routes/chat.ts', 'core/engine.ts', 'desktop/src/react/**'],
    tests: ['npm run typecheck'],
    branchPrefix: 'fleet/server',
    worktreePrefix: 'worktrees/fleet-server',
  },
  {
    id: 'docs-plan',
    label: 'Docs / planning',
    description: 'README, release notes, ops docs',
    owned: ['README.md', 'docs/**'],
    forbidden: ['server/**', 'core/**', 'desktop/src/react/**'],
    tests: ['git diff --check'],
    branchPrefix: 'fleet/docs',
    worktreePrefix: 'worktrees/fleet-docs',
  },
  {
    id: 'custom',
    label: 'Custom',
    description: '完全自定义任务范围',
    owned: [],
    forbidden: [],
    tests: ['npm run typecheck'],
    branchPrefix: 'fleet/custom',
    worktreePrefix: 'worktrees/fleet-custom',
  },
];

export const DEFAULT_FLEET_SCOPE_PRESET = FLEET_SCOPE_PRESETS[0]!;

export function slugifyBriefTitle(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'task';
}

export function buildPresetDefaults(preset: FleetScopePreset, title: string): FleetBriefDefaults {
  const slug = slugifyBriefTitle(title);
  return {
    owned: preset.owned.join('\n'),
    forbidden: preset.forbidden.join('\n'),
    tests: preset.tests.join('\n'),
    branch: `${preset.branchPrefix}-${slug}`,
    worktree: `${preset.worktreePrefix}-${slug}`,
  };
}

export function findPresetById(id: string): FleetScopePreset | undefined {
  return FLEET_SCOPE_PRESETS.find((p) => p.id === id);
}

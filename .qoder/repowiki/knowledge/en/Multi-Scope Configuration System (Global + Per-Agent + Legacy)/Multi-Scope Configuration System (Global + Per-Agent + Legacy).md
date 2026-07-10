---
kind: configuration_system
name: Multi-Scope Configuration System (Global + Per-Agent + Legacy)
category: configuration_system
scope:
    - '**'
source_files:
    - core/config.ts
    - core/preferences-manager.ts
    - core/config-coordinator.ts
    - shared/config-schema.ts
    - shared/config-scope.ts
    - shared/migrate-config-scope.ts
    - core/agent.ts
---

OpenShadow implements a three-layer configuration system that distinguishes between global user preferences, per-agent settings, and legacy single-process config — with explicit scope declarations and automated migration.

## What system/approach is used

- **Dual-persistence model**: Global settings live in `preferences.json` (user directory), agent-specific settings live in each agent's `config.yaml`, and a legacy `config.json` at process CWD for the old single-provider bootstrap path.
- **Schema-driven scoping**: A single source of truth (`shared/config-schema.ts`) declares every preference key, its storage scope (`global` | `agent`), optional setter/getter method names, and default values. Un-declared keys default to agent scope.
- **Runtime coordinator**: `ConfigCoordinator` orchestrates cross-cutting concerns — shared model resolution, search provider config, heartbeat/channel toggles, workspace home folder management, and session meta persistence — without holding engine references directly.
- **Atomic writes**: All preference updates go through `PreferencesManager.savePreferences()` which uses an atomic write pattern (write `.tmp` then rename) plus read-back verification for critical flags like `setupComplete`.

## Key files and packages

- `core/config.ts` — Legacy `ConfigManager` loading `config.json` with deep merge against `DEFAULT_CONFIG`; also provides multi-provider selection (`getActiveProvider`) and env-var fallbacks (`AGENT_API_KEY`, `AGENT_BASE_URL`, `AGENT_MODEL`).
- `core/preferences-manager.ts` — Full-featured `PreferencesManager` class managing `preferences.json` with typed getters/setters for sandbox, bridge, automation, computer-use, browser, editor, notifications, experiments, update channel, plugin UI, image/video generation, speech recognition, etc.
- `core/config-coordinator.ts` — Cross-cutting config orchestration: shared models (`utility`, `utility_large`, `vision`), search config, utility API override normalization, heartbeat master toggle, channels master toggle, workspace home folder GC, and `updateConfig` patching that persists to agent YAML and refreshes runtime modules.
- `shared/config-schema.ts` — Canonical declaration of all global-scope fields with `scope`, `setter`, `getter`, `prefsPath`, and `defaultValue`.
- `shared/config-scope.ts` — Runtime helpers `splitByScope(partial)` and `injectGlobalFields(config, engine)` that split incoming patches by declared scope and inject engine-provided values into the config object.
- `shared/migrate-config-scope.ts` — One-shot migration tool that lifts global-scope fields from all agents' `config.yaml` into `preferences.json` (preferring primary agent), backs up originals as `.pre-scope-migration`, and cleans them out.
- `core/agent.ts` — Loads per-agent `config.yaml` via `loadConfig()`, initializes memory/experience toggles, resolves utility/memory models with shared-model fallbacks, and persists changes back to disk.

## Architecture and conventions

**Persistence layout:**
```
<userDir>/
  preferences.json          ← global scope (PreferencesManager)
agents/<agentId>/
  config.yaml               ← agent scope (YAML, loaded by Agent)
  memory/                   ← facts.db, summaries, sessions...
  desk/                     ← cron runs, heartbeat state
CWD/
  config.json               ← legacy single-provider bootstrap (ConfigManager)
```

**Scoping rules enforced by schema:**
- Fields listed in `CONFIG_SCHEMA` with `scope: 'global'` are persisted to `preferences.json` and routed through their declared setter/getter methods on `PreferencesManager`.
- Nested paths support up to two levels (e.g. `'capabilities.learn_skills'`, `'desk.heartbeat_master'`).
- Any field not declared in the schema defaults to agent scope and goes into `config.yaml`.

**Resolution order for active LLM provider (legacy path):**
1. Explicit `models[role]` reference → find provider by id
2. Provider with `isDefault: true` (must have both apiKey and baseUrl)
3. Legacy `agent.*` fields (single-provider mode)
4. Environment variables `AGENT_API_KEY` / `AGENT_BASE_URL` / `AGENT_MODEL`

**Update flow for agent config patches:**
- `ConfigCoordinator.updateConfig(partial)` persists to agent's `config.yaml`, updates ModelManager default model if `models.chat` changed, syncs skills, and restarts heartbeat scheduler when `desk.heartbeat_interval` or `desk.heartbeat_enabled` changes.

**Migration strategy:**
- Scope migration runs once per installation, marked by `_configScopeMigrated` flag in preferences.
- Backs up original `config.yaml` before cleaning global-scope fields.
- Legacy default relaxation (`_defaultsRelaxedMigrated`) removes historically over-written `sandbox_network: false` so new default (enabled) takes effect.

## Rules developers should follow

1. **Declare new global preferences in `shared/config-schema.ts`** with `scope: 'global'`, a matching setter/getter pair on `PreferencesManager`, and a sensible `defaultValue`. This is the single source of truth for scoping.
2. **Use `splitByScope` / `injectGlobalFields`** when building REST routes that accept partial config patches — never manually decide where a field belongs.
3. **Persist agent-scoped settings only through `Agent.updateConfig()`** (invoked via `ConfigCoordinator.updateConfig`); do not write `config.yaml` directly from routes or services.
4. **For cross-cutting side effects** (heartbeat restart, skill sync, model refresh), route changes through `ConfigCoordinator` rather than touching subsystems directly.
5. **When adding new top-level keys**, ensure they are either declared in the schema (if global) or will naturally fall into agent scope; avoid ad-hoc placement in `preferences.json` without schema entry.
6. **Respect the atomic-write contract** — always use `PreferencesManager.savePreferences()`; never write `preferences.json` directly to avoid corruption.
7. **Environment variable overrides** for the legacy provider path must use `AGENT_API_KEY`, `AGENT_BASE_URL`, `AGENT_MODEL`; new providers should be configured via the wizard/providers array instead.
# OpenShadow

<p align="center">Your AI shadow — works in the dark, ships in the light.</p>

<p align="center">
  <a href="https://github.com/jingqiu2180/openshadow/blob/master/LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License"></a>
  <a href="#"><img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg" alt="Platform"></a>
  <a href="#"><img src="https://img.shields.io/badge/E2E%20tests-18%20passed-brightgreen.svg" alt="Tests"></a>
</p>

---

## What is OpenShadow

OpenShadow is a desktop AI agent. It watches your workspace, executes tasks in the background, and talks to you when you need it. You don't need to be a coder — write a note, and it gets to work.

It began as a fork of [openhanako](https://github.com/liliMozi/openhanako), then diverged into its own path: re-architected for stability, wired into Chinese LLM providers, and backed by an E2E test suite from scratch.

The name is a tribute to *The Eminence in Shadow* — the idea that the most powerful force is the one you don't see coming.

## Features

**Autonomous Patrol** — OpenShadow scans your workspace on a schedule. Drop a `jian.md` file in any folder with instructions, and it reads, understands, and executes — updating the task status as it goes. No need to open a chat. No need to be at your desk.

**Chat + Tools** — Full conversational AI with file read/write, bash execution, grep search, and directory listing. The agent can browse your files, edit code, run commands, and report back — all through natural language.

**Multi-Provider** — Built-in support for MiniMax, DeepSeek, Qwen (DashScope), and GLM (Zhipu). Any OpenAI-compatible endpoint auto-detected. Switch models per-session from the UI.

**Multi-Agent** — Run multiple agents with independent memories, personalities, and cron schedules. Agents can collaborate through channels or delegate tasks to each other.

**Desk & Jian** — Each agent has a "desk" workspace. Drag files, preview assets, write "jian" notes — the agent reads and acts on them during patrol. Async collaboration between you and your AI.

**Session Management** — Persistent conversation history searchable from the sidebar. Archive old sessions, restore when needed. Quote messages to keep context.

**Plugin System** — Extensible architecture. Plugins contribute tools, skills, commands, agent templates, LLM providers, and UI widgets. Two-tier permission model keeps things safe.

**Security** — Dual-layer sandbox: application-level path guard + OS-level isolation. Restricted access by default. Configurable per-workspace.

**Cron & Heartbeat** — Schedule recurring tasks. Heartbeat monitors workspace changes and triggers patrol automatically.

**Cross-Platform Desktop** — Electron app on Windows, macOS, and Linux. Dark and light themes built in.

**Internationalization** — Chinese, English, Japanese, Korean, and Traditional Chinese.

**E2E Tested** — 18 Playwright tests covering workspace selection, chat flow, settings, jian editing, mock AI streaming, and full business flows. 0 test failures.

## Quick Start

```bash
# Install
npm install

# Start (server + Vite + Electron, one command)
npm run electron:dev

# Run all E2E tests
npm run test:e2e

# Build for production
npm run build
```

## Architecture

```
desktop/          Electron 42 + React 19 + Zustand 5 (forked from openhanako)
core/             Agent engine, session management, provider routing
server/           Hono HTTP + WebSocket API (37 routes)
hub/              Background scheduler, cron, heartbeat, channels
plugins/          Built-in tools (read, write, bash, edit, grep, ls)
lib/              pi-sdk compatibility, shared utilities
shared/           Cross-layer helpers (config, error bus, workspace output)
tests/            E2E Playwright test suite (18 tests, CI ready)
```

## LLM Providers

Edit `config.json` and fill in your API keys:

```json
{
  "providers": [
    { "id": "minimax", "type": "openai", "baseUrl": "https://api.minimax.chat/v1",
      "models": ["MiniMax-M3"], "isDefault": true },
    { "id": "deepseek", "type": "openai", "baseUrl": "https://api.deepseek.com/v1",
      "models": ["deepseek-chat", "deepseek-reasoner"] },
    { "id": "qwen", "type": "openai", "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
      "models": ["qwen-plus", "qwen-max", "qwen-turbo"] },
    { "id": "glm", "type": "openai", "baseUrl": "https://open.bigmodel.cn/api/paas/v4",
      "models": ["glm-4-plus", "glm-4-flash"] }
  ],
  "models": { "main": "minimax::MiniMax-M3" }
}
```

## Tech Stack

| Layer | Tech |
|---|---|
| Desktop Shell | Electron 42 |
| Frontend | React 19 + Zustand 5 + CSS Modules |
| Build | Vite 7 + TypeScript 5.8 |
| Server | Hono + @hono/node-server |
| Agent Runtime | Pi SDK (`@mariozechner/pi-coding-agent`) |
| Database | better-sqlite3 |
| Testing | Playwright (E2E) + Vitest (unit) |
| CI | Gitee Go |

## Platform Support

| Platform | Status |
|---|---|
| Windows (x64) | ✅ Dev mode working |
| macOS (ARM / Intel) | ⚠️ Not tested |
| Linux (AppImage / deb) | ⚠️ Not tested |

## Development

```bash
# Dev mode
npm run dev               # Server with hot reload (tsx watch)
npm run electron:dev      # Full stack: server + Vite + Electron

# Build
npm run build             # TypeScript + asset copy
npm run electron:main     # Vite build main process
npm run electron:preload  # Vite build preload script
npm run desktop:build     # Vite build renderer

# Testing
npm run test:e2e          # All Playwright E2E tests
npm run test:unit         # Vitest unit tests
npm run typecheck         # TypeScript type check
```

## Credits

OpenShadow is forked from [openhanako](https://github.com/liliMozi/openhanako) by [liliMozi](https://github.com/liliMozi) — a solo developer's vibe-coded AI agent with 2,000+ commits. We diverged at commit `5d390121`.

What we changed:
- Rewired Electron main process from ESM+tsc to CJS+Vite (eliminated startup crashes)
- Added DeepSeek / Qwen / GLM Chinese LLM providers
- Fixed pi-sdk SessionManager placeholder with real package export
- Built E2E test suite from zero (18 tests, 13 scenarios, 0 failures)
- CI integration (Gitee Go)

## License

MIT

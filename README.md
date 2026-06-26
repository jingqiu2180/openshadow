# OpenShadow

> Your AI shadow that works in the dark. Autonomous patrol, task execution, file monitoring.

OpenShadow is a desktop AI agent based on [openhanako](https://github.com/liliMozi/openhanako), re-architected for stability and Chinese LLM ecosystem. It watches your workspace, executes tasks autonomously, and supports multiple AI providers.

## Features

- 🖥️ **Desktop App** — Electron + React 19, cross-platform (Windows / macOS / Linux)
- 🤖 **Multi-Provider** — MiniMax, DeepSeek, Qwen (DashScope), GLM (Zhipu)
- 🔍 **Autonomous Patrol** — Heartbeat scans workspace, executes jian tasks without user input
- 💬 **Chat + Tools** — LLM-powered conversations with file/bash/grep tools
- 📝 **Task Files** — `jian.md` per directory: write instructions, agent reads and executes
- 🧪 **E2E Tested** — 18 Playwright tests covering workspace, chat, settings, jian, flows
- 🔌 **OpenAI Compatible** — Any OpenAI-compatible API endpoint auto-detected
- 🌙 **Dark Theme** — Built-in warm-paper and cool-night themes

## Quick Start

```bash
# Install
npm install

# Start dev mode (server + Vite + Electron)
npm run electron:dev

# Run tests
npm test:e2e
```

## Architecture

```
desktop/          Electron + React 19 UI (forked from openhanako)
core/             Agent engine, session management, provider routing
server/           Hono HTTP + WebSocket API server (37 routes)
plugins/          Built-in tools (read/write/bash/edit/grep/ls)
lib/              pi-sdk compatibility, shared utilities
tests/            E2E Playwright tests
```

## LLM Providers

Edit `config.json`:

```json
{
  "providers": [
    { "id": "minimax", "type": "openai", "baseUrl": "https://api.minimax.chat/v1", "models": ["MiniMax-M3"], "isDefault": true },
    { "id": "deepseek", "type": "openai", "baseUrl": "https://api.deepseek.com/v1", "models": ["deepseek-chat", "deepseek-reasoner"] },
    { "id": "qwen", "type": "openai", "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1", "models": ["qwen-plus", "qwen-max", "qwen-turbo"] },
    { "id": "glm", "type": "openai", "baseUrl": "https://open.bigmodel.cn/api/paas/v4", "models": ["glm-4-plus", "glm-4-flash"] }
  ],
  "models": { "main": "minimax::MiniMax-M3" }
}
```

## Testing

```bash
npm run test:e2e          # All E2E tests (Playwright)
npm run test:e2e:chat     # Chat tests only
npm run test:e2e:jian     # Jian / task tests
npm run test:unit         # Unit tests (vitest)
```

## Credits

This project is forked from [openhanako](https://github.com/liliMozi/openhanako), a solo vibe-coded AI agent. OpenShadow diverged at commit `5d390121`, re-architecting the Electron startup, adding Chinese LLM providers, and building an E2E test suite from scratch.

## License

MIT

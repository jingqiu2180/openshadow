# remu

> 一个有个性和记忆的 AI 助手 —— 从零开始异世界生活·雷姆 🌸

remu 是一个基于 TypeScript + Hono 构建的 AI Agent，支持多渠道接入（飞书、QQ、微信）、长期记忆、人格模板、系统级沙箱安全隔离。

## 功能特性

### 核心能力
- 💬 **多渠道 Bot** — 飞书、QQ、微信同时接入
- 🧠 **长期记忆** — SQLite 本地存储 + LLM 自动摘要压缩
- 🎭 **人格模板** — 可切换的 Agent 性格系统
- 🔧 **工具集** — bash / 文件操作 / 网页截图 / 网络搜索
- 📟 **桌面端** — Electron 跨平台桌面应用
- 🔒 **系统级沙箱** — 进程隔离 + 熔断器 + 审计日志
- ⏰ **调度器** — Cron 定时任务 + 心跳主动上报

### 技术栈
- **运行时：** Node.js 18+
- **后端框架：** Hono（轻量、极速）
- **数据库：** better-sqlite3（本地持久化）
- **Agent：** OpenAI SDK（兼容千帆、OpenAI 等）
- **桌面端：** Electron
- **构建工具：** TypeScript + esbuild/vite

## 快速开始

### 安装依赖
```bash
npm install
```

### 启动开发模式
```bash
# 后端 API 服务
npm run dev

# 桌面端（另一个终端）
npm run electron:dev
```

### 构建
```bash
# 编译 TypeScript
npm run build

# 打包桌面应用
npm run electron:dist
```

### 测试
```bash
npm test
```

## 项目结构

```
remu/
├── channels/          # 渠道接入（飞书、QQ、微信）
├── core/
│   ├── agent.ts      # Agent 核心
│   ├── config.ts     # 配置管理
│   ├── desk.ts       # 文件管理
│   ├── dispatcher.ts  # 任务调度
│   ├── i18n.ts       # 多语言
│   ├── logger.ts     # 日志
│   ├── metrics.ts    # 指标收集
│   ├── sandbox/      # 系统级沙箱
│   ├── scheduler.ts  # 定时调度
│   ├── skills.ts     # 技能系统
│   ├── stt.ts        # 语音识别
│   └── tts.ts        # 语音合成
├── core/memory/      # 记忆存储 + 摘要
├── core/personality/  # 人格模板
├── core/tools/       # 工具集（bash/file/path-guard/screenshot/web）
├── db/               # SQLite 数据库 schema
├── desktop/          # Electron 桌面端
├── server/           # Hono 服务端 + WebSocket
├── tests/            # 单元测试
└── scripts/          # 构建脚本
```

## 配置说明

运行前需要配置渠道凭证，创建 `.env` 文件：

```bash
cp .env.example .env
```

然后填入对应的 API Key 和凭证。

## License

MIT
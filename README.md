# OpenShadow

> Your AI shadow that works in the dark.
> Autonomous patrol, task execution, file monitoring.

[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](https://github.com/jingqiu2180/openshadow/releases)
[![Release](https://img.shields.io/github/v/release/jingqiu2180/openshadow)](https://github.com/jingqiu2180/openshadow/releases)

---

## OpenShadow 是什么

OpenShadow 是一个桌面端 AI 智能体，会在你书桌背后默默巡检，帮你读完文件夹、跑完命令、改完代码、写完笔记；只有需要你拍板的时候才出声。

它的设计目标是把"agent 能力"从命令行里搬出来，让不写代码的人也能用：
- **记忆** — 记住你说过的每一件事，跨会话、跨设备。
- **人格** — 不是千篇一律的"AI 助手"。通过人格模板塑造独特的性格。
- **主动** — 不止被动应答：可以定时巡检文件、监控任务进度、自主安装并学习新技能。
- **多 Agent** — 同时跑多个助手，它们各有记忆、各有性格、各有定时任务，可以互相协作。
- **沙盒** — 默认受限，只能动你的工作目录；可调，不放权。

如果你用过 claude code、codex、Manus 等 CLI 或是图形化的 Agent，你会在 OpenShadow 这里找到熟悉又新奇的感觉。

OpenShadow fork 自 [openhanako](https://github.com/liliMozi/openhanako)，从 commit `5d390121` 起分叉独立维护：重写了打包链路、对接了更多中文模型供应商、修复了若干稳定性问题。

## 功能特性

**自主巡检** — 给一个文件夹写个 `jian.md` 笔记，OpenShadow 会按计划读它、跑里面的指令、把任务状态写回文件。你不需要打开聊天窗口，不需要守在电脑前。

**对话 + 工具** — 完整的对话式 AI，可以读写文件、执行命令、搜索内容、列目录、跑脚本，agent 能浏览你的文件、改你的代码、执行命令并回报。OpenAI 兼容、Anthropic 风格、Ollama 本地模型均可接入。

**多模型供应商** — 内置 OpenAI、DeepInfra、Fireworks AI、NVIDIA、Upstage、Anthropic、Agnes AI、阶跃星辰、火山引擎、百度智能云、魔搭 ModelScope、无问芯穹 等预设供应商，也支持**任意 OpenAI 兼容接口**（MiniMax / DeepSeek / 通义千问 / 智谱 GLM / 自建网关）。设置页可在供应商页签下添加自定义供应商。

**多 Agent** — 同时跑多个 agent，各自有独立的记忆、人格、定时任务。Agent 之间可以通过频道群聊协作，也可以互相委派任务。

**书桌** — 每个 Agent 都有自己的书桌，可以放文件、写笔记（agent 会主动读取并执行）。支持拖拽、文件预览、文件树监听 —— 这是你和 Agent 之间的异步协作空间。

**会话管理** — 侧栏支持聊天记录搜索（标题命中优先、必要时检索正文）；旧会话可以归档后从设置入口恢复或永久删除。聊天正文里的选中文本会进入输入框引用卡片，继续追问时保留原文语境。

**技能（Skills）** — 兼容 pi-mono Skills 生态。Agent 也可以自己编写并学会新技能。设置页可分组、拖拽、成组启用。

**安全沙盒** — 双层隔离：应用层 PathGuard 四级访问控制 + 操作系统级沙盒（macOS Seatbelt / Linux Bubblewrap / Windows restricted token）。Agent 的权限在你的掌控之中；设置 → 安全页面可调整沙盒级别。

**插件系统** — 拖拽安装社区插件，插件可以贡献工具、技能、命令、Agent 模板、HTTP 路由、LLM Provider、页面。两级权限模型（restricted / full-access）保障安全。

**跨平台接入** — 同一个 Agent 可以同时接入 Telegram、飞书、QQ、微信机器人，在任何平台和它对话、远程操作电脑。

**定时任务与心跳** — Agent 可以设置定时任务（Cron），也会定期巡检书桌上的文件变化。

**国际化** — 界面支持中文、英文、日文、韩文、繁体中文 5 种语言。

## 快速开始

### 下载安装

从 [Releases](https://github.com/jingqiu2180/openshadow/releases) 下载最新安装包：

- **Windows** — `OpenShadow-x.x.x-Windows-x64.exe`（当前约 366 MB）
- **macOS** — `.dmg`（Apple Silicon / Intel）
- **Linux** — `.AppImage` 或 `.deb`

> **Windows SmartScreen 提示：** 安装包暂未经过代码签名，首次运行时 Windows Defender SmartScreen 可能会拦截。点击 **更多信息** → **仍要运行** 即可，未签名版本的正常现象。

> **安装慢的临时缓解：** 解压阶段 Windows Defender 会对 `server-bundle` 数千小文件逐文件扫描，可在 病毒和威胁防护 → 排除项 临时添加 `%LOCALAPPDATA%\Temp`，装完移除。

> **就地升级提示：** 安装器会自动结束正在运行的旧 OpenShadow.exe，**不再出现"装完还是旧版"的回滚问题**（v0.4.4+ 已通过 NSIS customInit 阶段 taskkill 根治）。

### 首次运行

首次启动时，引导向导会带你完成配置：
1. 选择语言
2. 输入你的名字和助手昵称
3. 连接模型供应商（API key + base URL，可选已有预设或添加自定义）
4. 选择三个模型：**对话模型**（主对话）、**小工具模型**（轻量任务）、**大工具模型**（记忆编译和深度分析）
5. 选择工作区目录

之后所有配置都可以在设置页（托盘右键"设置"或主窗右上角 ⚙）修改。

### 命令行启动（开发者）

```bash
# 安装依赖
npm install

# 开发模式：server + Vite + Electron 一键拉起
npm run electron:dev

# 仅启动 Vite dev server（配合外部 Electron）
npm run dev

# 单独跑 server（无桌面壳，便于调试 API）
npm run server
```

## 架构

```
core/             Agent 引擎 + Manager（Agent/Session/Model/Preferences/Skill/Channel/BridgeSession/Plugin）
server/           Hono HTTP + WebSocket 服务（独立 Node.js 进程，由 Electron spawn）
hub/              调度器、频道路由、事件总线、cron、heartbeat
desktop/          Electron 应用 + React 19 前端（CJS+Vite 主进程，Zustand 5 状态）
shared/           跨层共享（config schema、error bus、模型引用、桥接适配）
plugins/          内置系统插件（随应用打包）
scripts/          构建工具（afterPack、闭包复制、签名、安装器定制）
tests/            Vitest 单元测试 + Playwright E2E 测试
```

**Server** 以独立 Node.js 进程运行（由 Electron spawn 或独立启动），通过 Vite 打包（external 闭包 + 确定性安全清理），与 Electron 渲染进程通过 WebSocket 通信。用户数据目录由 `OPENSHADOW_HOME` / `SHADOW_HOME` 决定（默认 `~/.openshadow`），Pi SDK 自己的数据隔离在 `${OPENSHADOW_HOME}/.pi/` 下。

**桌面端** 主进程是 CJS（Vite 编译为 `main.bundle.cjs`），渲染端是 React 19 SPA。Server 启动顺序：先 `await serverManager.start()` 拿到真实 port + token，才 `createMainWindow()` —— 保证首次打开就能连上后端、加载 i18n 资源。

**构建产物**（v0.4.4 实测，Windows）：
- 安装包 366 MB（v0.4.0 时代 474 MB，瘦 23%）
- server-bundle `node_modules` 256 MB（v0.4.0 时代 378 MB，瘦 32%）
- 457 包闭包，零外部拉取（afterPack 严格禁止 `npm install`）

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面端 | Electron 42（主进程 CJS + Vite 编译） |
| 前端 | React 19 + Zustand 5 + CSS Modules |
| 构建 | Vite 7 + TypeScript 5.8 |
| 服务端 | Hono + @hono/node-server（独立 Node 进程） |
| Agent 运行时 | [Pi SDK](https://github.com/badlogic/pi-mono)（`@mariozechner/pi-coding-agent`） |
| 数据库 | better-sqlite3（WAL 模式） |
| 测试 | Vitest（单元） + Playwright（E2E） |
| 国际化 | 5 语言（zh / en / ja / ko / zh-TW） |
| CI | GitHub Actions（仅 `push v*` tag 触发 Release 工作流） |

## 平台支持

| 平台 | 状态 | 安装包 |
|------|------|--------|
| Windows (x64) | ✅ 稳定 | `.exe` |
| macOS (Apple Silicon / Intel) | ✅ 构建产物已发布 | `.dmg` / `.zip` |
| Linux | ✅ 构建产物已发布 | `.AppImage` / `.deb` |
| 移动端 PWA | 暂未支持 | — |

> 当前 Release 链路：本地构建产物不入库，`git tag v*` → 推 GitHub → CI 自动构建并发布。

## 开发

```bash
# 开发
npm run dev               # 后端 tsx watch
npm run electron:dev      # 全栈：server + Vite + Electron

# 构建
npm run build             # TS + 资源复制
npm run electron:main     # 编译主进程为 main.bundle.cjs
npm run electron:preload  # 编译 preload
npm run desktop:build     # 编译渲染端

# 测试
npm run test:unit         # Vitest 单元
npm run test:e2e          # Playwright E2E
npm run typecheck         # TypeScript 类型检查

# 打包
npm run electron:build    # 本地打 .dir 包（快速迭代）
npm run dist:win          # 出 Windows 安装器
npm run dist:all          # 全平台安装器
```

**发版流程：** 改代码 → `git add` + `git commit` → `git push origin master` + `git push github master`（双推）→ `git tag v0.4.x && git push --tags` → GitHub Actions 自动构建并发布到 Release。

## 致谢

- [openhanako](https://github.com/liliMozi/openhanako) — OpenShadow 的上游项目，2,000+ commits 沉淀的 agent 内核与图形页面。分叉点：`5d390121`。
- [tw93/kami](https://github.com/tw93/kami) — beautify 插件 HTML 美学规范的渐进披露结构。
- Pi SDK 作者 [badlogic](https://github.com/badlogic) — 让 agent 能力封装得如此干净。

## 许可证

[MIT](LICENSE)

## 链接

- [官网](https://github.com/jingqiu2180/openshadow)
- [Releases](https://github.com/jingqiu2180/openshadow/releases)
- [提交 Issue](https://github.com/jingqiu2180/openshadow/issues)
- 国内 Gitee 镜像：`https://gitee.com/jingqiu2188/openshadow`（同步更新，但 CI 仅跑 GitHub）
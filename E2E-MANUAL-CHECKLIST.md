# E2E 手动验证清单 (Electron 窗口)

以下 3 项必须在**非 WorkBuddy 终端**（PowerShell / Git Bash / VSCode 终端）启动，因为：
- WorkBuddy 终端有 `ELECTRON_RUN_AS_NODE=1` 副作用，会让 Electron 退化成 Node
- WorkBuddy 沙箱拒绝 git 写操作

## 启动命令

```bash
cd D:\src\aicoding\openshadow
npm run electron:dev
```

或者拆开跑（看日志更清楚）：

```bash
# 终端 1
cd D:\src\aicoding\openshadow && npm run dev
# 终端 2
cd D:\src\aicoding\openshadow && npm run desktop:vite
# 终端 3
cd D:\src\aicoding\openshadow && npm run electron
```

## #1 启动向导 7 步

启动后如果 `config.json` 里的 `wizard.completed != true`，会自动弹出向导窗口。

按顺序检查：
- [ ] 窗口弹出（760x640,标题"Rem 启动向导"）
- [ ] Step 1: 语言选择 — 切换"中文/English/日本語/한국어"
- [ ] Step 2: 名字 + 记忆设置
- [ ] Step 3: 供应商选择 — 选一个已配置的 provider
- [ ] Step 4: 测试连接 — 应显示"连接成功"+ 延迟 ms
- [ ] Step 5: 模型选择
- [ ] Step 6: 工作台目录（多选）— 至少选 1 个
- [ ] Step 7: 完成
- [ ] 向导关闭后主窗口出现（1180x760）
- [ ] 关闭再启动不再弹向导（`wizard.completed=true` 已写）

**预期 console 日志**:
```
[wizard] window shown
[wizard] loaded HTML from ...
Electron starting...
[main] wizard done, opening main window
Main window created (dev=true)
```

## #2 主窗口三栏

主窗口 1180x760，三栏：
- 左 240px: Sidebar（会话列表）
- 中 1: ChatArea（消息 + 输入 + 快捷操作）
- 右 280px: DeskPanel（书桌 + 文件管理）

检查：
- [ ] 三栏正确显示（无空白 / 无错位）
- [ ] 主题应用（默认 warm-paper 米色）
- [ ] 点击 ChatArea "🌐 浏览器" 按钮 → 右侧弹出 BrowserPanel
- [ ] 点击 DeskPanel "📸 截图" → 自动注入 prompt 到输入框
- [ ] 输入"你好"按 Enter → 收到 streaming 响应

**关键测试**（验证截图 #3）:
- [ ] 点 "📸 截图" 按钮 → 等 3-5 秒 → assistant 回复中包含对当前屏幕的描述
- [ ] 点 "🌐 浏览网页" → 后续调用 `browser_new` → BrowserPanel 显示百度首页
- [ ] 浏览器内点击/输入 → Agent 收到结果

**关键测试**（验证 webview #33）:
- [ ] BrowserPanel URL 栏输入 `https://www.baidu.com` 回车 → 加载成功
- [ ] 浏览器窗口显示真页面（不是空白）
- [ ] 标题栏显示 "百度一下" 之类

## #4 browser_new 出真截图

在 ChatArea 输入框直接发：`打开 baidu.com 截图给我看`

应该看到：
- BrowserPanel 自动打开
- 加载 baidu.com
- Agent 调用 `browser_screenshot` → base64 注入 LLM → LLM 描述页面内容

**预期 console 日志**:
```
[browser:stdio] ... (no stderr from webview mode)
[mainWindow] browser:command received
[mainWindow] browser:response sent
```

## 已知问题

1. **主进程 config.json 写盘**:沙箱拒 EPERM。手动验证时不在沙箱里，应该正常。
2. **截图 PowerShell**:已修（`#3 E2E 测试修复`），现在应该正常出图。
3. **MCP**:如果没装 `@modelcontextprotocol/server-filesystem`，请先 `npm install` 它才能用 MCP 工具。

## 验证完成后

回复：
- 哪些 PASS
- 哪些 FAIL（贴 console.log + 错误截图）
- 卡在哪一步

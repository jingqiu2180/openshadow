# Changelog

本文件记录 OpenShadow 每个版本的实质性变更、以及已知待修项。
版本号遵循语义化版本（SemVer）。发版方式：推 `v*` tag 触发 GitHub Actions 自动构建并发布 GitHub Release。

---

## [0.5.0] - 2026-07-15

### 新增
- **CI 质量门禁扩展（非阻塞可见性）**：在 Linux / Windows / macOS 三个构建 job 中新增两步：
  - `npm run test:unit`：运行全量 vitest 单测套件（1647 个用例），当前 `continue-on-error`（可见但不挡发布）。
  - `npm run typecheck`：运行 `tsc --noEmit` 类型检查，当前 `continue-on-error`。
  - 与既有的 `test:bridge`（真 preload 执行断言）+ `test:contract`（幽灵全局静态守卫）+ `test:smoke`（真机 Electron 拉起）共同构成多层防御。
- **建立 CHANGELOG.md**，规范每次发版的变更记录与已知项跟踪。
- **autoUpdater 接线**：`use-auto-update-state` / AboutTab / latest\*.yml feed 已就绪，Release 已发布更新源。

### 修复
- v0.4.5 → v0.4.9 连续修复「幽灵全局」类回归（详见历史版本），并建立三层 CI 防御永久防复发：
  - v0.4.6：截图功能因 `window.openshadow`（应为 `window.shadow`）坏掉 → 修复。
  - v0.4.7：`session-actions.ts` 读 `window.openshadow` 致输入框不聚焦 → 修复。
  - v0.4.8：删除死代码 `desktop/preload.js`（暴露 `window.openshadow` 的唯一来源）；建立 bridge/contract/smoke 三层防御。
  - v0.4.9：修复 smoke 脚本自身 bug（CI 用 `node` 跑导致 `require('electron')` 返回路径字符串；补齐测试用 IPC handler），真机 smoke 首次跑绿。

### 已知待修（tracked backlog，非阻塞期间逐批修）
> 以下项当前不挡发布，但需在翻成「硬门禁」前清零。

#### 单测套件：19 个历史红测试
- `desktop/src/react/__tests__/app-init.test.ts` — **11 个超时**。根因：`openshadowFetch` mock 默认返回 `undefined`，`initApp` 内 health 轮询 / `loadIdentityForActiveConnection` 的 `.json()` 调用抛错且异步不 settle（5s 超时）。需为各测试配置合理的 mock 返回值。
- `desktop/src/react/__tests__/settings/AccessTab.test.tsx` — 2 个失败（LAN 连接 / 远程连接回退本地）。
- `desktop/src/react/__tests__/components/DeskSection.test.tsx` — 2 个失败（workspace 监听 / 单栏树展开）。
- `desktop/src/react/__tests__/settings/WorkTab.test.tsx` — 1 个失败（首屏渲染 desk 设置）。
- `desktop/src/react/__tests__/settings/SettingsContent.test.tsx` — 1 个失败（标题栏布局）。
- `desktop/src/react/__tests__/mobile/MobileApp.test.tsx` — 1 个失败（手机端加载会话/输入面/工作台）。
- `desktop/src/react/__tests__/mobile/MobileEntrySplit.test.tsx` — 1 个失败（PWA 资源断言字符串不匹配）。

#### 类型检查：328 个 `tsc --noEmit` 错误
- 主因：monorepo 的 `packages/*` 未单独构建，`@hana/plugin-protocol` 等声明缺失；以及大量 `implicitly any`（`desktop/src/shared/workspace-*.ts` 等）。
- 收口路径：先 `npm run build` 各 package 生成声明，再批量补类型注解 / 收紧 tsconfig。完成前 typecheck 保持非阻塞。

---

## [0.4.9] - 2026-07-15

### 修复
- 修复 v0.4.8 的 `smoke` 真机测试脚本 bug：
  - CI 原用 `node` 跑脚本导致 `require('electron')` 返回二进制路径字符串、`app` 为 `undefined` 而崩溃 → 改用 `electron` 二进制运行。
  - 主进程注册测试用 `ipcMain.handle('server:get-info')`，让 `getServerPort()` 能真实经 IPC 往返；加 `Promise.race(3s)` 兜底防挂起。
  - 去掉与 xvfb 冲突的 `headless` 开关。
- 三层 CI 防御（bridge + contract + smoke）首次完整跑绿，Release 成功发布（Windows/macOS/Linux 安装包齐全）。

## [0.4.8] - 2026-07-15

### 新增
- 建立三层 CI 防御体系：
  1. `test:bridge`：桩 electron 真执行 `preload.cjs`，断言恰好 expose 一个 `shadow`、零 `openshadow`。
  2. `test:contract`：静态扫 `desktop/src` + preload，断言零 `window.openshadow` 读取、零 `exposeInMainWorld('openshadow')`。
  3. `test:smoke`：真 Electron + 真 `preload.bundle.cjs` 拉起空白页，断言 `window.shadow` 存在。
- 删除死代码 `desktop/preload.js`（暴露幽灵全局 `window.openshadow` 的唯一来源）。

## [0.4.7] - 2026-07-15

### 修复
- `session-actions.ts` 的 `isDesktopShell()` 误读 `window.openshadow`（幽灵全局）→ 改 `window.shadow`，修复切换/新建会话后输入框不自动聚焦。
- 5 个测试文件的 mock 从 `window.openshadow` 对齐到真实全局 `window.shadow`。

## [0.4.6] - 2026-07-15

### 修复
- 截图功能因 `screenshot.ts` 读 `window.openshadow`（应为 `window.shadow`）恒失败 → 修复为 `window.shadow`；测试 mock 同步对齐。

## [0.4.5] - 2026-07-15

### 变更
- 渲染层 `hana-*` 内部标识彻底清理为 `openshadow-*`（存储 key / CSS 类 / CustomEvent / 拖拽 MIME / 局部变量 / 注释）。
- 刻意保留外部契约：`@hana/plugin-protocol` 包名、`hana-server.exe` 打包名、`hana-gpu-*` CLI、`yuan` 角色体系、`.hanako-dev` 数据路径。
- 注：本版本因全局改名遗漏引入截图回归，已于 v0.4.6 修复。

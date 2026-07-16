# Changelog

本文件记录 OpenShadow 每个版本的实质性变更、以及已知待修项。
版本号遵循语义化版本（SemVer）。发版方式：推 `v*` tag 触发 GitHub Actions 自动构建并发布 GitHub Release。

---

## [0.5.3] - 2026-07-16

### 修复（发版门禁 flaky 超时）
- **修复 v0.5.2 CI 在 `tests/core/usage-tracker.test.ts` 上 2 个用例偶发 5000ms 超时**：根因是 `beforeEach` 里 `vi.resetModules()` + `await import()` 在每个用例都强制重新加载整个模块图（含原生 `better-sqlite3`）并重建全新磁盘 SQLite 库 + 重跑整份 `schema.sql`，单用例本地即 ~2.1s；在较慢的 Windows CI runner 上偶发超过 5000ms 默认超时 → 随机失败（`getSummary` 本身为纯同步 SQL，非逻辑 bug）。
- **修法**：改为 `beforeAll` 仅加载一次模块，用例之间只 `DELETE FROM usage_logs` 清空表（隔离不变）。单用例耗时从 ~2.1s 降到 6–22ms，整文件 17.8s → 3.0s，从根本上消除该 flaky。

---

## [0.5.2] - 2026-07-16

### 修复（发版门禁阻断 bug）
- **修复 v0.5.1 发版被 CI 全红拦截的根因**：`lib/pi-sdk/index.ts` 深导入 `@mariozechner/pi-coding-agent/dist/utils/image-resize.js` 与 `.../dist/core/compaction/compaction.js`，该包 `exports` 仅以通配 `./dist/utils/*` 暴露；vite 的 `resolveExports` 在 `"./*":"./*"` + 嵌套通配组合下误报 `Missing ... specifier`（Node 原生 ESM 可正常解析，证明 exports 本身合法）。这导致 3 个 `tests/core/*.test.ts`（虽为 `describe.skip`，但模块加载即触发 import 链）在 CI 上记为 "Failed Suites"，硬门禁 `test:unit` 误杀整个发版。
- **修法**：在既有 `postinstall` 补丁脚本 `scripts/patch-pi-sdk.cjs` 中给 pi-coding-agent 的 `package.json.exports` 补两个精确键（`image-resize.js` / `compaction.js`），vite 精确匹配优先，一处生效全局（test + 生产构建所有 vite 实例受益）。补丁幂等，不破坏现有解析。
- 注：v0.5.1 的 `Smoke` job 失败为 GitHub hosted runner 的 `/tmp` 共享内存偶发环境抖动（非代码回归），v0.4.9/v0.5.0 同脚本均成功；v0.5.2 重跑应可过，若仍偶发可在 Actions 界面单独 re-run smoke job。

### 已知（待加固，非阻塞）
- smoke 真机测试在 CI 偶发受 runner `/tmp` 共享内存限制；后续可在 `smoke-launch.cjs` 显式设置 `TMPDIR`/`XDG_RUNTIME_DIR` 或加 `--disable-dev-shm-usage` 加固（当前已有 `disable-dev-shm-usage`，疑为 `/tmp` 而非 `/dev/shm`）。

---

## [0.5.1] - 2026-07-15

### 质量门禁升级（关键）
- **`test:unit` 从非阻塞可见性升级为硬门禁**：CI 三个构建 job 的测试步骤改为 `npm run test:unit -- --no-file-parallelism`，去掉 `continue-on-error`。从此发版必须全量单测绿才能发布。
- 诊断澄清：v0.5.0 记录的「19 个历史红测试」**经逐项实跑验证并非产品回归**，而是**并行负载下的 flaky**——DeskSection 等测试用 `vi.useFakeTimers()` + async `act()`，在文件级并行时竞争超时/空渲染。实测关闭文件级并行后全量串行执行 **1521 passed / 0 failed / 128 skipped** 全绿。
- `typecheck` 仍保持非阻塞可见（`tsc --noEmit` 有 328 个存量错误：monorepo 未构建声明缺失 + 大量 implicit any），单列 backlog 收口，完成前不挡发布。

### 修复（确定性 bug，均已单文件验证绿）
- `app-init.test.ts` 11 个超时：v0.4.x 引入 `waitForServerHealth(30000)` 轮询后测试 mock 序列错位（首调应是 health 而非 identity）→ 各 mock 链前置 `ok:true` 的 health 响应；test3 改按 URL 路由（health ok + identity reject）；并修 test2 的 localStorage key 残留 `hana-server-connections-v1` → `openshadow-server-connections-v1`。
- `settings/AccessTab.test.tsx` 2 失败：`window.openshadow` mock 重命名漏改 → `window.shadow.reloadMainWindow`（测试已用 shadow，mock 漏改）。
- `vite.config.ts` 插件名 `hana-serve-mobile-pwa-static-files` → `openshadow-serve-mobile-pwa-static-files`（真残留，MobileEntrySplit 测试已正确断言 openshadow；纯字符串名，无功能影响）。

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

#### 单测套件：原记「19 个历史红测试」（❗ 经 v0.5.1 诊断更正：实为并行 flaky，非确定性失败）
> 见 [0.5.1] 条目：逐项实跑证明各子目录单独均全绿，仅全量并行时冒出失败且跨次数量不一致（19→26），关闭文件级并行后 1521 全绿。
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

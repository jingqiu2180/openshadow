# OpenShadow vs openhanako 特性移植清单（更新版）

> 生成于 2026-07-19，基于本地 `D:/src/aicoding/openhanako`(v0.403.0, commit `12f275bc`) 与
> `D:/src/aicoding/openshadow`(v0.6.4) 的**直接代码+依赖探测**，非凭记忆。
> 本清单**更正并取代** 2026-07-16 的 `openshadow-vs-openhanako-analysis.md`（其中两处已过时，见文末）。

图例：✅ 已对齐 / 对等　🔶 部分 / 路线分歧　❌ 未移植（真实差距）　🆕 openshadow 自有

---

## A. 核心架构（✅ 全部对齐）

| # | 项 | openhanako | openshadow | 状态 |
|---|----|-----------|-----------|------|
| A1 | 独立 Node 运行时 | `hana-server.exe` + bootstrap | `openshadow-server.exe` + bootstrap | ✅ 架构一致 |
| A2 | 独立 Node 版本 | v24.15.0 | **v22.22.2 (ABI127)** | 🔶 被迫分歧（原生模块用 managed Node22 编）|
| A3 | vite external 声明 | 14 string + 2 regex | 逐字一致 | ✅ |
| A4 | 启动回退逻辑 | 独立 exe 否则 ELECTRON_RUN_AS_NODE | 同 | ✅ |
| A5 | build-server 方案 | nft 文件级 | 包级闭包（nft 在 401 包大图卡死，判死）| 🔶 路线分歧（非功能差距）|
| A6 | electron main/preload (CJS+Vite) | 是 | 移植自上游 (f1b025f) | ✅ |
| A7 | tsconfig 模式 | openhanako pattern | 对齐 (cc94258) | ✅ |

## B. 五大系统（✅ 全部对等）

| # | 系统 | 状态 | 备注 |
|---|------|------|------|
| B1 | 记忆系统 (memory/vector-store/reflection) | ✅ 对等 | openshadow 甚至更多（向量库+反思运行器）|
| B2 | 插件系统 (plugin-protocol/runtime/sdk/components) | ✅ 对等 | 四件套齐全 |
| B3 | 移动端 PWA (react/mobile) | ✅ 对等 | MobileApp/mobile-init/mobile-platform 同结构 |
| B4 | 国际化 (en/ja/ko/zh-TW/zh) | ✅ 对等 | openshadow 额外做了 zh 报错人话化 |
| B5 | Computer Use (core/computer-use + overlay) | ✅ 对等 | |

## C. 功能特性（✅ 基本对标）

| # | 特性 | openhanako 标记物 | openshadow 标记物 | 状态 |
|---|------|------------------|------------------|------|
| C1 | 自动更新 (electron-updater) | 11 / 2 | 9 / 0* | ✅ 双方都有 |
| C2 | 首次向导 (provider+API key) | onboarding 35 | 32（移植 f1b804a）| ✅ |
| C3 | MCP 工具 | 47 | 54 | ✅ openshadow 更多 |
| C4 | Skills 系统 | 141 | 127 | ✅ |
| C5 | Agent/多 turn/session/memory | 123 | 144 | ✅ openshadow 更多 |
| C6 | Vision/多模态 | 91 | 70 | ✅ |
| C7 | GPU 加速 (hana-gpu-*) | 27 | 21（保留 hana-gpu-*）| ✅ |
| C8 | OAuth 鉴权流 | 48 | 39 | 🔶 通用 OAuth 框架在，少精选流（xai-oauth 等）|
| C9 | Tray / 快捷键 | tray 9 / shortcut 19 | 8 / 18 | ✅ |
| C10 | 一键诊断导出（脱敏） | — | 新建 (3ed1cff) | 🆕 openshadow 独有 |

> *openshadow 的 `electron-updater` 字符串 0 次是因为依赖在 package.json 而非源码字面量；功能已接（`use-auto-update-state` + `auto-updater.cjs`）。

## D. ❌ 真正的差距（只有一处硬核 + 两处工程分歧）

| # | 差距 | openhanako | openshadow | 性质 |
|---|------|-----------|-----------|------|
| **D1** | **Provider 精修集成数** | **37 个** builtin 插件（`lib/providers/`）+ 19 个 UI 预设 + 17 个 `provider-compat` 行为子模块 | **36 个** builtin 插件 + **25 个** `builtin.ts` 向导精选 + **14 个** `provider-compat` 子模块（2026-07-19 核查：原「仅 3 个」是 v0.5.6 过时误读，当时只数了 `builtin.ts` 类型字段，漏看整套 `lib/providers/` 插件体系）| 🔶 **已基本对齐**，仅差 `opencode-go`（纯数据，2026-07-19 补齐并验证）+ `xai-oauth`（需 `lib/auth` OAuth 基建，架构 follow-up）|
| D2 | 构建体积 nft 裁剪 | nft 文件级（小树 trace）| 包级闭包复制（nft 在 401 包大图卡死，改用确定性裁剪）| 🔶 体积优化分歧，非功能差距 |
| D3 | 代码签名 / notarize | notarize.cjs / sign-local.cjs / release-digest | 仅基础 autoUpdater（Windows 未签名 → SmartScreen 恐吓）| 🔶 发布工程分歧 |

## E. 🆕 openshadow 自有（openhanako 没有）

- 中文报错人话化（`serverNotReady` → "服务未就绪，请重启应用"）
- 一键诊断信息导出（设置→关于，脱敏打包 `~/.openshadow` 日志）
- README 故障对照表（未就绪/连接失败/SmartScreen/安装慢）
- GitHub + **Gitee 镜像双发**
- 自建严格 CI（unit 硬门禁 + bridge/contract/smoke 三层 + typecheck）

## F. Pi SDK 代际（⚠️ 07-16 说"断裂"，今天核实**已修复**）

- 07-16 结论：openhanako 已换 `@earendil-works`，openshadow 卡在 `@mariozechner` → 代际断裂，backport 几乎不可能。
- **今天实测**：openshadow `package.json` 也是 `@earendil-works/pi-ai` + `@earendil-works/pi-coding`。
- **结论：断裂已消除，两边 Pi SDK 生态已重新对齐。** 这意味着"选择性 cherry-pick 上游新功能"重新可行。

## G. 取长补短优先级（更新版）

| 优先级 | 项 | ROI | 风险 | 动作 |
|--------|----|-----|------|------|
| **P0** | **Provider 精修集成补齐**（D1）| 高 | 低 | 2026-07-19 核查：精选表/插件体系早已对齐（`builtin.ts` 25 + 插件 36，commit d937db9 已从 6 扩到 25）。当天补齐 `opencode-go` 并验证（health + /providers/summary 确认）。剩余 `xai-oauth` 需 OAuth 基建（`lib/auth`），列为架构 follow-up |
| **P1** | 代码签名（D3，消 SmartScreen）| 高 | 中 | 买证书 + 接 `release.yml` 签名步骤（产品化讨论已确认）|
| **P2** | nft 体积裁剪（D2）| 中 | 中 | 可选；验证 server 仍能启动 |
| **P3** | notarize/sign-local 借鉴（Mac）| 中 | 中 | 跨平台时再做 |
| 已完成 | LICENSE 文件 / 五大系统 / 自动更新 / 向导 / 报错人话 / 诊断导出 | — | — | ✅ 已在 0.6.x 落地 |

---

### 一句话总结
**架构、五大系统、自动更新、向导、MCP/Skills/Agent/Vision/GPU/OAuth 全部与 openhanako 对等或反超；provider 精修集成经 2026-07-19 核查已基本实现面对齐（openshadow 36 插件 + 25 精选 vs openhanako 37 插件 + 19 预设），仅差 `xai-oauth`（需 OAuth 基建）。Pi SDK 代际断裂已自愈。openshadow 还多了中文产品化（报错人话/诊断导出/双发/严格 CI）。**

### 对 07-16 / 07-19 文档的更正
1. ~~"Mobile PWA 缺失"~~ → 实测 `desktop/src/react/mobile/` 对等，**已对齐**。
2. ~~"Pi SDK 代际断裂（最严重）"~~ → 实测 openshadow 也已迁移到 `@earendil-works`，**断裂已修复**。
3. ~~"provider 仅 3 个通用 OpenAI 兼容，openhanako 39 手写（唯一显著差距）"~~ → 2026-07-19 核查为 **v0.5.6 过时误读**：openshadow 已有 `lib/providers/` 36 插件 + `builtin.ts` 25 精选 + `provider-compat/` 14 子模块，中国主流全覆盖，与 openhanako（37 插件 + 19 预设 + 17 compat）基本面对齐；真实剩余仅 `opencode-go`（当天补齐）+ `xai-oauth`（需 OAuth 基建）。
（07-16 文档的"构建体积 nft""LICENSE 缺失"两项仍成立，LICENSE 已在后续补上。）

# OpenShadow vs openhanako（v0.403.0）仔细对比与取长补短

> 生成于 2026-07-16。基于本地仓库 `D:/src/aicoding/openhanako`（golden source）与
> `D:/src/aicoding/openshadow` 的**直接代码对比**，非凭记忆。

## 0. 一个重要更正

上一轮对话里我记的「openhanako v0.350.2」是旧缓存。实际 golden source 已是 **v0.403.0**。
更关键的是——上游**已经更换了 Pi SDK 供应商**（见 §2.3）。这是代际断裂，不是简单的版本落后。

## 1. 核心事实（已核实）

| 维度 | openhanako（上游） | OpenShadow |
|------|-------------------|------------|
| 版本 | **0.403.0** | 0.5.6 |
| Pi SDK | `@earendil-works/pi-*` 0.80.3 | `@mariozechner/pi-*`（**不同生态**） |
| Node 要求 | ≥24.12，打包锁 v24.15.0 runtime | 系统 Node |
| License | Apache-2.0（GitHub 含 LICENSE） | Apache-2.0 声明但**根目录无 LICENSE 文件** |
| CI | 本地 golden source **无 `.github`**（无法证实更成熟） | 自建完整门禁 |
| 发布渠道 | 仅 GitHub（liliMozi/openhanako） | GitHub + **Gitee 镜像** |
| autoUpdater | electron-updater + notarize + sign-local + release-digest | 已接（use-auto-update-state） |
| 产品定位 | 全功能个人 AI 助理（记忆/灵魂/多Agent/插件/多平台/移动端/国际化） | 编码自动化「影子」（巡逻/任务/文件监控） |

## 2. 四个劣势逐一对比

### 2.1 功能深度（**重大修正**：五大系统 OpenShadow 全有，非缺失）

> ⚠️ 修正（2026-07-16 14:59）：此前结论称 OpenShadow「缺失记忆/插件/多平台/移动端/国际化」
> 是**错误的**。经逐系统实测代码，五大系统两边均为**对等（parity）**，OpenShadow 一项不少。

| 系统 | OpenShadow | openhanako | 结论 |
|------|-----------|-----------|------|
| **记忆系统** | `core/memory/` 14 文件 / 3092 行（含 `vector-store.ts`、`deep-memory.ts`、`memory-reflection-runner.ts`、`memory-ticker.ts`） | `lib/memory/`（`deep-memory.ts` 等） | **对等**，OpenShadow 甚至多了向量库+反思运行器 |
| **插件系统** | `packages/plugin-protocol` + `plugin-runtime` + `plugin-sdk` + `plugin-components` 四件套齐全 | 同四件套 | **完全对等** |
| **移动端 PWA** | `desktop/src/react/mobile/`（MobileApp / mobile-init / mobile-platform）+ vite 插件 `openshadow-serve-mobile-pwa-static-files` | `desktop/src/react/mobile/` 同结构 | **对等** |
| **国际化** | `desktop/src/locales/`：`en/ja/ko/zh-TW/zh` 五语言 | 同五语言 | **完全对等** |
| **Computer Use** | `core/computer-use/` + `tools/computer-use-tool.ts` + overlay UI | `core/computer-use/` + build helper | **对等** |

**真正的差距收窄到一处——provider（多模型平台）接入的「广度与精修」：**

- OpenShadow `core/providers/`：`adapter.ts`（OpenAI 兼容适配）+ `builtin.ts`（**Stage 1a** 目录，仅 baseUrl 形式的 OpenAI/Minimax 等几项）+ `index/tester/types/usage-tracker`。`ProviderType = openai|gemini|ollama|custom|anthropic`，本质是一个**通用 OpenAI 兼容适配层**——理论上**设 baseUrl 即可连任何 OpenAI 兼容的中国模型**（DeepSeek/Qwen/GLM 等），只是没做成「开箱即用的精选集成」。
- openhanako `lib/providers/`：**41 个手写精修 provider 文件**，含 deepseek、qwen/dashscope、zhipu、hunyuan、kimi、baichuan、minimax、volcengine（豆包）、stepfun、siliconflow、baidu（文心）、mistral、groq、together、perplexity、xai、fireworks、modelscope、infini、openrouter…，外加 `provider-compat/qwen.ts`、**`jimeng-cli` 插件（字节即梦 图/视频）**、OAuth 流（`xai-oauth`、`openai-codex-oauth`）、coding 专用变体（`kimi-coding`/`zhipu-coding`/`dashscope-coding`/`volcengine-coding`）、语音（`system-speech`/`volcengine-speech`）。

**结论**：OpenShadow 的 5 大系统能力**不落后**；唯一显著的功能广度差距是 **provider 精修集成数**（上游 40+ 手写集成 vs 我们通用适配层）。但这差距被「OpenAI 兼容适配」大幅稀释——中国主流模型基本都能手动接，只是不如上游一键/带 token 计划/OAuth。

**取长补短（务实）**：
1. **高 ROI**：把 `builtin.ts` 的精选目录补齐到覆盖中国主流（DeepSeek/Qwen/GLM/Hunyuan/Kimi/Minimax/Volcengine 等）——纯数据表扩展，零架构改动。
2. **中 ROI**：移植上游的 `token-plan`（mimo/minimax）与 OAuth 流，解决国内某些 provider 的计费/鉴权特殊逻辑。
3. **低优先**：`jimeng-cli` 这类图/视频生成插件属差异化玩法，按需再引。

### 2.2 构建体积更大（高 ROI 可补）

上游 `scripts/build-server.mjs` 用完整优化管线：
Vite bundle + **@vercel/nft 文件级追踪裁剪** + 多平台二进制清理（koffi/node-pty）
+ `.d.ts`/`.map`/死重清理 + 锁定 Node runtime 保证 ABI（v24.15.0）。

OpenShadow `scripts/_copy-deps.cjs` 是**包级闭包复制**：把 vite externals 的完整传递依赖
闭包（含所有 `.d.ts`/`.map`/test）整棵复制进 `server-bundle/node_modules`，**无 nft 文件级裁剪**
——这是体积主因。

**取长补短（推荐）**：把上游 nft 裁剪逻辑移植到 OpenShadow 的 `afterPack`
（`fix-modules.cjs`）或 `_copy-deps.cjs` 末尾——在 `server-bundle/node_modules` 上跑
`nodeFileTrace`，删未追踪文件 + 删多平台二进制 + 删 `.d.ts/.map`。ROI 高、风险中
（需验证 server 仍能启动）。注意 OpenShadow 走 electron-builder `app.asar` 内 node_modules，
路径与上游客服 standalone 目录不同，需适配，不能直接 copy 上游脚本。

### 2.3 上游同步断档（最严重——需战略决策）

上游已换 Pi SDK 供应商为 `@earendil-works`，OpenShadow 仍用 `@mariozechner`。
这意味着 OpenShadow 不是「落后 300 版本」，而是**活在上游已弃用的 Pi 生态分支上**。
backport 上游新功能几乎不可能（SDK API 不兼容）。

**取长补短策略（三选一，需拍板）**：
- **A. 冻结演进**：接受永久 drift，在 mariozechner 分支独立演进。
- **B. 大迁移**：一次性迁移到 earendil-works，续接上游新功能（成本高、需重测 Pi SDK 集成）。
- **C. 选择性 cherry-pick**：只搬运与 Pi SDK 无关的纯逻辑修复（记忆/工具/UI）。

### 2.4 CI 并非我们领先（已修正——实为优势）

本地 golden source **无 `.github` 目录**，无法证实上游 CI 更成熟。
OpenShadow 自建了完整 CI（test:unit 硬门禁 + bridge/contract/smoke 三层 + typecheck +
CHANGELOG + autoUpdater feed）。**此劣势不成立**——在可验证范围内，OpenShadow 的 CI
反而更严格、更可见。

## 3. 额外发现的补短点

- **A. LICENSE 合规缺失（必做，低风险）**：OpenShadow 声明 Apache-2.0 但根目录无 LICENSE 文件。
  开源合规要求附许可证全文，否则有法律风险。需创建 `LICENSE`（Apache-2.0 全文 + copyright）。
- **B. Pi SDK 代际风险**：见 §2.3，最长线风险。
- **C. autoUpdater 完整性**：上游有 `notarize.cjs`/`sign-local.cjs`/`release-digest`，
  OpenShadow 可借鉴完善 Mac 签名链路。

## 4. 取长补短优先级行动清单

| 优先级 | 项 | ROI | 风险 | 建议动作 |
|--------|----|-----|------|----------|
| **P0** | 补 LICENSE 文件 | 高 | 低 | 立即创建 Apache-2.0 LICENSE |
| **P1** | 构建体积 nft 裁剪 | 高 | 中 | 移植上游 nft 管线到 afterPack，验证 server 启动 |
| **P2** | 战略决策 Pi SDK 迁移 | 高 | 高 | 选 A/B/C，先规划再动 |
| **P3** | 借鉴记忆/插件架构 | 中 | 高 | 评估是否纳入 coding 定位 |
| **P4** | autoUpdater 完善（Mac 签名） | 中 | 中 | 借鉴 notarize/sign-local |

## 5. 建议下一步

1. **现在**：补 LICENSE（P0，低风险高价值，已在执行）。
2. **本周**：做 P1 体积裁剪（最划算的工程改进）。
3. **需要拍板**：P2 的 A/B/C 战略方向——这决定 OpenShadow 未来是「独立分支」还是「续接上游」。

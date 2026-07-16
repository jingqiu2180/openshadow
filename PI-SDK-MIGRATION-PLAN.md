# Pi SDK 迁移方案：@mariozechner → @earendil-works 0.80.3

> 状态：**已执行**（2026-07-15 起，2026-07-16 修正 scope 处理）。⚠️ 2026-07-16 干净重装核验后，§1.3 关于 `@mariozechner/clipboard` 仍存在的原假设被证实成立；此前 07-15 的「整替换 scope」修正已撤销，改为双 scope 并存（见 §1.3 更正）。
> 范围：把 OpenShadow 冻结的 `@mariozechner/pi-ai@0.70.5` + `@mariozechner/pi-coding-agent@^0.70.2`
> 升级到上游同款 `@earendil-works/pi-ai@0.80.3` + `@earendil-works/pi-coding-agent@0.80.3`。
> 依据：openhanako commit `3413ec43`（feat(sdk): 升级 Pi SDK 至 @earendil-works 0.80.3）第一手 diff + OpenShadow 现状实查。

---

## 0. 决策与版本

- **迁移（确认）**。目标版本与上游对齐：`@earendil-works/pi-ai@0.80.3` + `@earendil-works/pi-coding-agent@0.80.3`（精确钉版，不用 caret）。
- **升版策略**：OpenShadow `0.5.6` → `0.6.0`（scope 迁移属依赖生态变更，行为语义不变，按 minor 走）。
- **中国镜像风险已排除**：已实查 `npm view @earendil-works/pi-ai@0.80.3 version --registry https://registry.npmmirror.com` 返回 `0.80.3`，与 npmjs 一致 → 发布/CI 安装通道无碍（OpenShadow `.npmrc` 即 npmmirror）。

---

## 1. 已查证的事实

### 1.1 根因
npm scope **发布者变更**：`@mariozechner/*` → `@earendil-works/*`，旧分支冻结。OpenShadow 钉在旧 scope 0.70.x 失去同步入口，故需迁移。

### 1.2 0.80.3 API 变化（来自上游 diff，必须逐条对应）
| API | 0.70.x（现 OpenShadow） | 0.80.3（目标） | 处理 |
|---|---|---|---|
| `completeSimple` | `@mariozechner/pi-ai` 根导出 | `@earendil-works/pi-ai/compat` 子入口 | 改 import 路径 |
| `getModel` | `@mariozechner/pi-ai` 根导出 | `@earendil-works/pi-ai/compat` 子入口 | 改 import 路径 |
| `resizeImage` / `formatDimensionNote` | 深路径 `dist/utils/image-resize.js` | **包根导出** `@earendil-works/pi-coding-agent` | 改 import 路径（去掉深路径） |
| `convertToLlm` | 包根导出（旧 scope） | 包根导出（新 scope） | 仅改名 |
| `resizeImage` 签名 | `(img: ImageContent, options?)` | `(inputBytes: Uint8Array, mimeType, options?)`, 内部吞错返回 `null` | **门面内解码 base64→Uint8Array + 拆 mimeType** |
| `prepareCompaction` | 深路径 `dist/core/compaction/compaction.js` | 深路径（同，未转根导出） | 仅改名 scope |
| `StringEnum` | `@mariozechner/pi-ai` | `@earendil-works/pi-ai` | 改名 |
| `registerOAuthProvider` | `@mariozechner/pi-ai/oauth` | `@earendil-works/pi-ai/oauth` | 改名 |
| `createAssistantMessageEventStream` | `@mariozechner/pi-ai` | `@earendil-works/pi-ai` | 改名 |

### 1.3 ⚠️ OpenShadow 专属陷阱：`@mariozechner/clipboard` **未改名（实测确认）**

> **最终结论（2026-07-16 干净重装 + `npm ls` + `package-lock.json` 三重确认）**：
> `@earendil-works/pi-coding-agent@0.80.3` 的 `package.json` 把 `@mariozechner/clipboard@0.3.9` 列为 **`optionalDependencies`**，且该包**确实被拉入 node_modules**（顶层 `@mariozechner/clipboard` + 平台包 `@mariozechner/clipboard-win32-x64-msvc` 均在 lock 中）。
> 因此原 §1.3 假设「0.80.3 仍依赖 @mariozechner/clipboard」**成立**。
>
> ⚠️ 更正：此前 2026-07-15 的「执行修正」笔记称「0.80.3 完全不含 @mariozechner、已整替换 scope」是**错误结论**（当时未做干净安装核验，误判）。实际执行已**撤销整替换**，恢复双 scope 并存。
>
> OpenShadow 自身代码不依赖它：`lib/pi-sdk/vendor/clipboard-native.js` 的 `require("@mariozechner/clipboard")` 是死代码（全仓无任何消费方 import），但其所属 Pi SDK 内部仍可能按需 require。为杜绝打包后运行时 `ERR_MODULE_NOT_FOUND`，**构建脚本必须「保留 @mariozechner（给 clipboard）+ 新增 @earendil-works（给 pi 包）」双 scope 并存**：
> - `vite.config.server.js` external：同时追加 `/^@mariozechner\//`（与 `/^@earendil-works\//` 并存，非替换）
> - `scripts/build-server.mjs`：external 追加 `"@mariozechner/*"`
> - `scripts/_copy-deps.cjs`：`listScopePackages` 同时扫 `@earendil-works` 与 `@mariozechner`；并显式把 `@mariozechner/clipboard` + `@mariozechner/clipboard-win32-x64-msvc` 纳入 `viteExternals` 硬校验
> - `scripts/fix-modules.cjs`：`SERVER_DYNAMIC_SAFE_KEEP` 含 `@mariozechner`；`requiredServerDeps` 含 `@mariozechner/clipboard`
> - `scripts/_verify-external-closure.cjs`：`mustExist` 与 `dynImports` 含 `@mariozechner/clipboard`
> - `scripts/patch-pi-ai.js`（孤儿补丁）已 `git rm` 删除（postinstall 未引用；0.80.3 的 null-guard bug 已修复/不再需要），此删除不受 scope 调整影响。

0.80.3 中 `pi-coding-agent` 仍把 `@mariozechner/clipboard` 作为 `optionalDependencies`（已确认实为传递依赖，未被 photon-node 替代）。
OpenShadow `lib/pi-sdk/vendor/clipboard-native.js` 运行时 `require("@mariozechner/clipboard")`，但全仓无消费方（死代码）。
→ **构建脚本必须保留 `@mariozechner` scope**（双 scope 并存，见上方更正），不能同时删除/改名。

---

## 2. 影响文件清单（按改动类型，全部已实查定位）

### 2.1 依赖声明
- `package.json`：第 161-162 行两行替换；`version` 0.5.6 → 0.6.0。
- `package-lock.json`：`npm install` 自动重写（确认走 npmmirror）。

### 2.2 门面层（核心，对齐 openhanako `lib/pi-sdk/index.ts` diff）
- `lib/pi-sdk/index.ts` — 最重。要点：
  - 所有 `@mariozechner/pi-coding-agent` → `@earendil-works/pi-coding-agent`
  - `getModel`/`completeSimple` 改从 `@earendil-works/pi-ai/compat` 导入
  - `resizeImage`/`formatDimensionNote`/`convertToLlm` 改从**包根** `@earendil-works/pi-coding-agent` 导入（去掉 `../../node_modules/.../dist/...` 深路径），仅 `prepareCompaction` 保留深路径（新 scope）
  - `resizeModelImageInput` 函数体改为：`const inputBytes = Buffer.from(String(image?.data ?? ""), "base64"); return rawResizeImage(inputBytes, image?.mimeType, options);`
  - `StringEnum` → `@earendil-works/pi-ai`；`registerOAuthProvider` → `@earendil-works/pi-ai/oauth`
  - 注释/JSDoc 类型引用 `@mariozechner/pi-coding-agent` → `@earendil-works/pi-coding-agent`
- `lib/pi-sdk/stream-guard.ts` — 第 1-2 行两处 `@mariozechner/pi-ai` → `@earendil-works/pi-ai`。
- `lib/pi-sdk/search-tools.ts` — 第 24-27 行导入块 `@mariozechner/pi-coding-agent` → `@earendil-works/pi-coding-agent`。
- `lib/pi-sdk/session-options.ts` — `import.meta.resolve("@mariozechner/pi-coding-agent")`、pkg name 校验、报错文案 → 全改 `@earendil-works/pi-coding-agent`。
- **删除 `lib/pi-sdk/vendor/compaction.js`**（死代码：无人 import；且其内部 `import { completeSimple } from "@mariozechner/pi-ai"` 会被双 scope 泄漏扫描命中）。OpenShadow 的 compaction 已通过门面 re-export 的 `prepareCompaction`/`generateSummary` 走 SDK 本体，无需此本地副本。

> 门面外消费方已确认安全：唯一两处直接调用 `completeSimple` 的是 `core/session-compactor.ts:451` 与 `lib/llm/session-snapshot-side-task-runner.ts:94`，二者均 `import { completeSimple } from '../lib/pi-sdk/index.js'`（经门面），门面改名对它们透明。

### 2.3 构建/打包脚本（OpenShadow 专属，openhanako 无这些文件，务必逐项改）
- `vite.config.server.js`：第 24 行 `external` 增加 `/^@earendil-works\//`（**保留** `/^@mariozechner\//` 给 clipboard）。
- `scripts/build-server.mjs`：第 248 行 `"@mariozechner/*"` 处**追加** `"@earendil-works/*"`（保留 mariozechner 给 clipboard）；第 422 行注释补 earendil-works。
- `scripts/fix-modules.cjs`：
  - 第 122 行 `SAFE_KEEP` 列表加 `"@earendil-works"`
  - 第 241 行 `requiredServerDeps` 的 `"@mariozechner/pi-ai"` → `"@earendil-works/pi-ai"`
  - 第 350/370 行 `@mariozechner/*` exports 补丁循环：复核是否需扩展到 `@earendil-works/pi-coding-agent` 深路径（见 4.高危4）
- `scripts/_copy-deps.cjs`：第 34-42 行 `@mariozechner` 作用域闭包扫描，**镜像新增** `@earendil-works` 块（保证 pi 包全家桶进 server-bundle）。
- `scripts/_verify-external-closure.cjs`：第 65 行 `@mariozechner` 目录计数逻辑、`第 71 行` `@mariozechner/pi-ai/package.json` → `@earendil-works/pi-ai/package.json`、`第 100 行` dynImports 的 `@mariozechner/pi-ai` → `@earendil-works/pi-ai`（否则闭包校验会 FAIL）。
- `scripts/patch-pi-ai.js`：对 `node_modules/@mariozechner/pi-ai` 的 null-guard 补丁。**先验证 0.80.3 是否仍存在该 bug**：若已修复则删除此补丁；若仍需，改目标路径为 `@earendil-works/pi-ai`。

### 2.4 校验/泄漏脚本
- `scripts/patch-pi-sdk.cjs`：
  - 第 20-21 行 `sdkRoot`/`piAiRoot` → `@earendil-works/...`
  - 第 22-23 行 `verifiedVersions`/`verifiedPiAiVersions` → `["0.80.3"]`
  - 第 47、76 行 `@mariozechner` 报错文案与 `importPattern` → 收紧为**双 scope 且仅 `(pi-ai|pi-coding-agent)`**（对齐 openhanako）：
    `/@(?:mariozechner|earendil-works)\/(?:pi-ai|pi-coding-agent)/`（这样 `@mariozechner/clipboard` 自然排除，clipboard-native.js 不被误报）
  - `patchExports()`：第 112-114 行 `needed` 去掉 `./dist/utils/image-resize.js`（已转根导出，深文件可能已不存在），**保留** `./dist/core/compaction/compaction.js`（prepareCompaction 仍是深路径）。

### 2.5 测试（移植上游新增/改动）
- **新增 `tests/pi-sdk-image-resize.test.ts`**：`resizeImage` 签名回归（见附录 A，直接落地）。
- **改 `tests/pi-sdk-import-boundary.test.ts`**（若无则新增）：pattern 收敛为双 scope 仅 `(pi-ai|pi-coding-agent)`。
- 建议**新增门面冒烟测试** `tests/pi-sdk-facade-smoke.test.ts`：断言 `completeSimple`/`getPiModel`/`resizeModelImageInput` 能从 `/compat` 与包根解析（最高风险点——`/compat` 子入口若不存在，build 立即暴露，但单测更早卡死）。
- 对齐上游其余 pi-sdk 测试改动（create-session-adapter / search-tools / session-options），若 OpenShadow 有等价测试则同步 scope 名。

---

## 3. `lib/pi-sdk/index.ts` 精确改动（执行者可直接照抄上游 diff）

关键 import 段（对照当前 OpenShadow 第 14-40 行）：
```ts
import {
  createAgentSession as rawCreateAgentSession,
  ModelRegistry,
  resizeImage as rawResizeImage,
  formatDimensionNote as rawFormatDimensionNote,
  convertToLlm as rawConvertToLlm,
} from "@earendil-works/pi-coding-agent";
// 0.80.0 起 pi-ai 老全局 API 移到 /compat 子入口
import {
  getModel as rawGetPiModel,
  completeSimple as rawCompleteSimple,
} from "@earendil-works/pi-ai/compat";
import {
  normalizeCreateAgentSessionOptions,
  PI_BUILTIN_TOOL_NAMES,
} from "./session-options.js";
import { installAssistantStreamGuard } from "./stream-guard.js";
import { createFindTool, createGrepTool } from "./search-tools.js";
// prepareCompaction 0.80.3 仍未从包根导出，深路径保留（升级时必查此文件是否存在）
import {
  prepareCompaction as rawPrepareCompaction,
} from "../../node_modules/@earendil-works/pi-coding-agent/dist/core/compaction/compaction.js";
```
`resizeModelImageInput` 函数体（对照当前第 144-146 行）：
```ts
export async function resizeModelImageInput(image, options) {
  const inputBytes = Buffer.from(String(image?.data ?? ""), "base64");
  return rawResizeImage(inputBytes, image?.mimeType, options);
}
```
其余 re-export（`SessionManager`/`DefaultResourceLoader`/`formatSkillsForPrompt`/`estimateTokens` 等、`StringEnum`、`registerOAuthProvider`、`ToolDefinition` JSDoc）全部 `@mariozechner/pi-coding-agent` → `@earendil-works/pi-coding-agent`、`@mariozechner/pi-ai` → `@earendil-works/pi-ai`。

---

## 4. 高危点与验证策略

- **高危1（必卡死）`resizeImage` 新签名**：门面内 base64→Uint8Array 解码 + mimeType 拆参，消费侧契约（`{type,data,mimeType}` 对象）不变。用附录 A 的 `image-resize.test.ts` 锁死；`core/model-image-preprocess.ts` 行为不变。
- **高危2 `/compat` 子入口存在性**：build 立即暴露，但加门面冒烟单测更早卡死；`patch-pi-sdk.cjs` 白名单 0.80.3 也兜底。
- **高危3 双实例 / OAuth**：OpenShadow 当前 `registerOAuthProvider` **零消费方**（全仓 grep 仅 `index.ts` 导出，无调用）→ 上游注明的「嵌套 pi-ai 实例 oauth registry 互不可见」陷阱暂不影响；但仍需在 smoke 阶段手测 OAuth provider 登录流程（若有）确认可用。
- **高危4 partial-json 传递依赖**：历史 `crash.log` 记录 `@mariozechner/pi-ai@0.70.5` 漏装 `partial-json`（`ERR_MODULE_NOT_FOUND`）。`fix-modules.cjs:241` 用 `requiredServerDeps` 兜底。0.80.3 需重验 `partial-json` 是否仍被需要、兜底是否仍生效；`_copy-deps.cjs` 闭包扫描要覆盖新 scope。
- **高危5 stale bundle**：`dist/`、`dist-server-bundle/`、`release/` 含旧 scope 编译产物（gitignore，不入库）。执行时必须清缓存重建，CI 三平台重跑。
- **高危6 clipboard 仍走 @mariozechner**：构建脚本（vite external / build-server.mjs / fix-modules / _copy-deps / _verify-external-closure）必须**保留 @mariozechner 处理 + 新增 earendil-works**，严禁整块改名。

---

## 5. 执行步骤（有序）

1. 切分支 `feat/pi-sdk-earendil-migration`；`git status` 确认工作区干净。
2. 改 `package.json` 依赖两行 + `version` → 0.6.0。
3. 改门面四件套（`index.ts` / `stream-guard.ts` / `search-tools.ts` / `session-options.ts`）+ **删除** `vendor/compaction.js`。
4. 改 5 个构建/校验脚本（§2.3、§2.4）。
5. 移植/新增测试（§2.5）。
6. 本地干净重装：`rm -rf node_modules dist dist-server-bundle && npm install`（npmmirror）→ `npm run build`（server bundle）。
7. 跑 `npm run test:unit` + 新增 `pi-sdk-image-resize` / 门面冒烟测试。
8. 本地无头 server 冒烟：`ELECTRON_RUN_AS_NODE= SHADOW_HOME=/tmp/os-smoke SHADOW_PORT=xxxx node dist-server-bundle/index.js`，确认 `/api/health` ok 且写真实 token。
9. `git status` 确认无 `release/`、`dist/`、`node_modules/` 漏提交。
10. 推送双 remote（gitee origin + github）；CI 三平台绿 + Release 发出后，**下载安装包实测**图片缩放 / OAuth / 长会话 compaction。

---

## 6. 验收清单
- [ ] `npm run test:unit` 全绿，含 `pi-sdk-image-resize` 与门面冒烟。
- [ ] server bundle 构建无 `ERR_MODULE_NOT_FOUND`（含 partial-json / @earendil-works 解析）。
- [ ] `patch-pi-sdk.cjs` 双 scope 泄漏扫描 0 泄漏（clipboard 不误报）。
- [ ] 安装包内 `resources/server-bundle/node_modules` 同时含 `@earendil-works/pi-*` 与 `@mariozechner/clipboard`。
- [ ] 手动：发送带图消息 → 图片缩放生效；长会话 → compaction 触发；OAuth provider 登录可用。

---

## 附录 A：`tests/pi-sdk-image-resize.test.ts`（直接落地，移植自 openhanako）

```ts
/**
 * 回归测试：门面 resizeModelImageInput 对 Pi SDK resizeImage 的签名适配。
 * 0.80.3 起上游 resizeImage 签名 (inputBytes: Uint8Array, mimeType, options?)，
 * 门面负责 base64 解码 + 拆参；消费侧契约不变。
 */
import { describe, expect, it } from "vitest";
import { resizeModelImageInput, formatModelImageDimensionNote } from "../lib/pi-sdk/index.ts";

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAa0lEQVR42g3JQQEAMAgDMZwgpVIqhXOCFKTUypZvqoouVLiYYosrUlQ13ahxM80216R/iBYSFiNWnIh+mDYyNmPWnIl/DD1o8DDDDjdkfiy9aPEyyy63ZH8cfejwMcced+R+hA4KDhM2XEh4nZNXkTSLioEAAAAASUVORK5CYII=";

describe("pi-sdk resizeModelImageInput signature adapter", () => {
  it("resizes an oversized image and returns the ResizedImage contract", async () => {
    const result = await resizeModelImageInput(
      { type: "image", data: TINY_PNG_BASE64, mimeType: "image/png" },
      { maxWidth: 4, maxHeight: 4 },
    );
    expect(result).not.toBeNull();
    expect(typeof result.data).toBe("string");
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.mimeType).toMatch(/^image\//);
    expect(result.originalWidth).toBe(8);
    expect(result.originalHeight).toBe(8);
    expect(result.width).toBeLessThanOrEqual(4);
    expect(result.height).toBeLessThanOrEqual(4);
    expect(result.wasResized).toBe(true);
    expect(typeof formatModelImageDimensionNote(result)).toBe("string");
  });

  it("passes through an image already within bounds without resizing", async () => {
    const result = await resizeModelImageInput(
      { type: "image", data: TINY_PNG_BASE64, mimeType: "image/png" },
      { maxWidth: 64, maxHeight: 64 },
    );
    expect(result).not.toBeNull();
    expect(result.wasResized).toBe(false);
    expect(result.originalWidth).toBe(8);
    expect(result.originalHeight).toBe(8);
    expect(formatModelImageDimensionNote(result)).toBeUndefined();
  });
});
```

/**
 * 门面冒烟测试：在单测阶段尽早卡死最高风险点 ——
 *  1. @earendil-works/pi-ai/compat 子入口存在（completeSimple / getModel 来自这里）
 *  2. @earendil-works/pi-coding-agent 包根导出存在（resizeImage 等）
 *  3. prepareCompaction 深路径（dist/core/compaction/compaction.js）经 patch-pi-sdk.cjs
 *     补 exports 后仍可解析
 *
 * 若这些 import 在 0.80.3 中路径变化，这里会在 vitest 阶段立即报错，
 * 比等到构建 server-bundle 才发现更早。
 */
import { describe, expect, it } from "vitest";
import * as facade from "../lib/pi-sdk/index.ts";

describe("pi-sdk facade smoke (0.80.3 entry points resolve)", () => {
  it("completeSimple is exported as a function (from /compat)", () => {
    expect(typeof facade.completeSimple).toBe("function");
  });

  it("getPiModel is exported as a function (from /compat)", () => {
    expect(typeof facade.getPiModel).toBe("function");
  });

  it("resizeModelImageInput is exported as a function (from package root)", () => {
    expect(typeof facade.resizeModelImageInput).toBe("function");
  });

  it("prepareCompaction deep path is re-exported", () => {
    // 直接 import 深路径已在 index.ts 顶部执行；若解析失败模块加载即抛错。
    expect(typeof facade.prepareCompaction === "function" || facade.prepareCompaction !== undefined).toBe(true);
  });

  it("core session tools resolve (createAgentSession etc.)", () => {
    expect(typeof facade.createAgentSession).toBe("function");
  });
});

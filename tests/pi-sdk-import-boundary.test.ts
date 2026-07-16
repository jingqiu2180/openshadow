/**
 * 静态边界测试：源码不得再 import 旧的 @mariozechner/pi-ai 或
 * @mariozechner/pi-coding-agent（0.80.3 已整体迁移到 @earendil-works scope）。
 *
 * 注意：
 *  - 0.80.3 依赖树【仍含】@mariozechner/clipboard（pi-coding-agent 的
 *    optionalDependencies，真实传递依赖），构建脚本已把它 external + 闭包复制。
 *    但它仅被 lib/pi-sdk/vendor 死代码（不被打包）孤立 require，源码无活引用，
 *    所以不在此测试禁止范围（仅管 pi-ai / pi-coding-agent 两个迁移包）。
 *  - 本测试不扫描 tests/、dist/、node_modules/、release/，避免误报自身体。
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");

// 仅扫描源码根目录，跳过构建产物/依赖/测试自身/会话日志。
const SCAN_ROOTS = ["lib", "core", "scripts", "desktop"];
const SKIP_SEGMENTS = [
  "node_modules",
  "dist",
  "dist-server-bundle",
  "dist-renderer",
  "release",
  ".git",
  "agents",
  "tests",
];

const FORBIDDEN = /@mariozechner\/(?:pi-ai|pi-coding-agent)\b/;
// 允许的 pi-sdk scope（迁移目标）。
const ALLOWED = /@earendil-works\/(?:pi-ai|pi-coding-agent)\b/;

function walk(dir: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (SKIP_SEGMENTS.some((s) => e.name === s)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(full, out);
    } else if (e.isFile()) {
      // 仅扫描代码文件；.md 等文档散文可能历史性提及旧 scope，不计入导入边界。
      if (e.name.endsWith(".md")) continue;
      out.push(full);
    }
  }
}

describe("pi-sdk import boundary (no stale @mariozechner pi-* scope)", () => {
  const files: string[] = [];
  for (const r of SCAN_ROOTS) walk(path.join(ROOT, r), files);

  it("scans a non-trivial set of source files", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("contains zero @mariozechner/pi-ai or @mariozechner/pi-coding-agent imports", () => {
    const leaks: Array<{ file: string; line: number; text: string }> = [];
    for (const f of files) {
      const text = fs.readFileSync(f, "utf8");
      const lines = text.split("\n");
      lines.forEach((ln, i) => {
        if (FORBIDDEN.test(ln)) leaks.push({ file: f, line: i + 1, text: ln.trim() });
      });
    }
    expect(leaks, JSON.stringify(leaks, null, 2)).toEqual([]);
  });

  it("still references the migrated @earendil-works pi-* scope somewhere (sanity)", () => {
    let count = 0;
    for (const f of files) {
      const text = fs.readFileSync(f, "utf8");
      if (ALLOWED.test(text)) count++;
    }
    expect(count).toBeGreaterThan(0);
  });
});

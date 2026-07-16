/**
 * patch-pi-sdk.cjs — Pi SDK 只读验证
 *
 * 历史上这个脚本会在 postinstall 阶段修改
 * node_modules/@mariozechner/pi-coding-agent/dist/core/sdk.js，
 * 为 Hana 的 session-scoped sandbox tools 打通 baseToolsOverride。
 *
 * Pi SDK 0.68+ 已把 createAgentSession({ tools }) 改成工具名 allowlist，
 * Hana 现在通过 lib/pi-sdk 适配层把本地 Tool[] 转为 customTools + names。
 * 因此这个脚本主要验证版本、SDK 结构和生产 import 边界；
 * 此外会就地给 pi-coding-agent 的 package.json exports 补精确键，
 * 修复 vite 对通配 exports 的深导入解析失败（见 patchExports）。
 *
 * 文件名（patch-pi-sdk）保留是为了不动 package.json 的 postinstall 钩子，
 * 避免触发 npm install cache 重算。log 前缀保持 verify-pi-sdk。
 */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const sdkRoot = path.join(root, "node_modules", "@mariozechner", "pi-coding-agent");
const piAiRoot = path.join(root, "node_modules", "@mariozechner", "pi-ai");
const verifiedVersions = new Set(["0.70.2"]);
const verifiedPiAiVersions = new Set(["0.70.5"]);

function fail(message) {
  console.error(`[verify-pi-sdk] ${message}`);
  process.exit(1);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

if (!fs.existsSync(sdkRoot)) {
  console.log("[verify-pi-sdk] SDK not installed, skipping");
  process.exit(0);
}

const pkg = readJson(path.join(sdkRoot, "package.json"));
if (!verifiedVersions.has(pkg.version)) {
  fail(`SDK version ${pkg.version} is not verified. Verified versions: ${[...verifiedVersions].join(", ")}`);
}

if (!fs.existsSync(piAiRoot)) {
  fail("@mariozechner/pi-ai is not installed");
}
const piAiPkg = readJson(path.join(piAiRoot, "package.json"));
if (!verifiedPiAiVersions.has(piAiPkg.version)) {
  fail(`pi-ai version ${piAiPkg.version} is not verified. Verified versions: ${[...verifiedPiAiVersions].join(", ")}`);
}

const sdkIndex = fs.readFileSync(path.join(sdkRoot, "dist", "index.js"), "utf8");
const expectedExportMarkers = [
  "createAgentSession",
  "createReadTool",
  "createWriteTool",
  "createEditTool",
  "createBashTool",
  "createGrepTool",
  "createFindTool",
  "createLsTool",
  "parseSessionEntries",
  "buildSessionContext",
];

for (const marker of expectedExportMarkers) {
  if (!sdkIndex.includes(marker)) {
    fail(`expected SDK export marker not found: ${marker}`);
  }
}

const scanDirs = ["core", "server", "lib", "hub"].map(d => path.join(root, d));
const adapterDir = path.join(root, "lib", "pi-sdk");
const importPattern = /(?:from\s+["']@mariozechner\/|import\s*\(\s*["']@mariozechner\/|require\s*\(\s*["']@mariozechner\/)/;
const leaks = [];

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full === adapterDir || entry.name === "node_modules") continue;
      scanDir(full);
    } else if (/\.(js|mjs|cjs|ts)$/.test(entry.name)) {
      const content = fs.readFileSync(full, "utf8");
      if (importPattern.test(content)) {
        leaks.push(path.relative(root, full));
      }
    }
  }
}

for (const dir of scanDirs) scanDir(dir);

if (leaks.length > 0) {
  fail(`production files bypass lib/pi-sdk: ${leaks.join(", ")}`);
}

// ── 修复 vite 对 pi-coding-agent 通配 exports 的深导入解析失败 ──
// vite 的 resolveExports 在处理 ".*" 全通配 + 嵌套 "./dist/utils/*" 组合时，
// 对 "@mariozechner/pi-coding-agent/dist/utils/image-resize.js" 这类深导入
// 会误报 "Missing ... specifier"（Node 原生 ESM 可正常解析，证明 exports 本身合法）。
// 补精确键让 vite 走精确匹配（优先级高于通配），根治该解析 bug。
// 影响范围：test (vitest) + 生产构建（所有 vite 实例）统一受益。
function patchExports() {
  const pkgPath = path.join(sdkRoot, "package.json");
  const json = readJson(pkgPath);
  if (!json.exports || typeof json.exports !== "object") return;
  const needed = {
    "./dist/utils/image-resize.js": "./dist/utils/image-resize.js",
    "./dist/core/compaction/compaction.js": "./dist/core/compaction/compaction.js",
  };
  let changed = false;
  for (const [key, target] of Object.entries(needed)) {
    if (!(key in json.exports)) {
      json.exports[key] = target;
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(pkgPath, JSON.stringify(json, null, 2) + "\n", "utf8");
    console.log("[verify-pi-sdk] patched package.json exports (added deep-import specifiers for vite)");
  } else {
    console.log("[verify-pi-sdk] package.json exports already patched");
  }
}
patchExports();

console.log("[verify-pi-sdk] all checks passed");

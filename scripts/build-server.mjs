#!/usr/bin/env node
/**
 * build-server.mjs — 构建 server 独立分发包（对齐 openhanako）
 *
 * 策略：下载指定 Node.js → Vite bundle → 用目标 Node 装 external 依赖
 * 解决原生模块（better-sqlite3 等）ABI 与 Electron Node 版本不匹配问题
 *
 * 产出：dist-server/{os}-{arch}/
 *   openshadow-server.exe    ← 捆绑的 Node.js（Windows 改名）
 *   bootstrap.js             ← 启动入口
 *   bundle/
 *     index.js               ← Vite 输出的 server bundle
 *   node_modules/            ← 外部依赖（用目标 Node 安装）
 *   package.json
 */
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { builtinModules } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const platform = process.argv[2] || process.platform;
const arch = process.argv[3] || process.arch;
const osDirName = platform === "darwin" ? "mac" : platform === "win32" ? "win" : platform;
const outDir = path.join(ROOT, "dist-server", `${osDirName}-${arch}`);

console.log(`[build-server] Building for ${platform}-${arch} → ${outDir}`);

// ── 0. 清理 ──
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

// ── 1. 下载 Node.js runtime ──
const NODE_VERSION = "v24.15.0";
const NODE_RUNTIME_SHA256 = {
  [`node-${NODE_VERSION}-win-x64.zip`]: "cc5149eabd53779ce1e7bdc5401643622d0c7e6800ade18928a767e940bb0e62",
};
const cacheDir = path.join(ROOT, ".cache", "node-runtime");
fs.mkdirSync(cacheDir, { recursive: true });

const nodeMap = { "win32-x64": `node-${NODE_VERSION}-win-x64` };
const nodeDirName = nodeMap[`${platform}-${arch}`];
if (!nodeDirName) {
  console.error(`[build-server] ⚠ 不支持的平台: ${platform}-${arch}`);
  process.exit(1);
}

const isWin = platform === "win32";
const ext = isWin ? "zip" : "tar.gz";
const filename = `${nodeDirName}.${ext}`;
const cachedArchive = path.join(cacheDir, filename);
const cachedNodeBin = isWin
  ? path.join(cacheDir, nodeDirName, "node.exe")
  : path.join(cacheDir, nodeDirName, "bin", "node");
const cachedNpmCli = isWin
  ? path.join(cacheDir, nodeDirName, "node_modules", "npm", "bin", "npm-cli.js")
  : path.join(cacheDir, nodeDirName, "lib", "node_modules", "npm", "bin", "npm-cli.js");

function verifyArchive(archivePath, archiveName) {
  const expected = NODE_RUNTIME_SHA256[archiveName];
  if (!expected) throw new Error(`[build-server] missing checksum for ${archiveName}`);
  const actual = createHash("sha256").update(fs.readFileSync(archivePath)).digest("hex");
  if (actual !== expected) {
    try { fs.rmSync(archivePath, { force: true }); } catch {}
    throw new Error(`[build-server] checksum mismatch for ${archiveName}`);
  }
  console.log(`[build-server] Node.js checksum verified: ${archiveName}`);
}

if (!fs.existsSync(cachedNodeBin)) {
  const url = `https://nodejs.org/dist/${NODE_VERSION}/${filename}`;
  console.log(`[build-server] downloading Node.js ${NODE_VERSION}...`);

  try {
    execSync(`curl --fail --location --show-error -o "${cachedArchive}" "${url}"`, { stdio: "inherit" });
  } catch {
    // curl 不可用，用 PowerShell fallback（Windows）
    console.log("[build-server] curl failed, trying PowerShell...");
    execSync(`powershell -command "Invoke-WebRequest -Uri '${url}' -OutFile '${cachedArchive}'"`, { stdio: "inherit" });
  }

  verifyArchive(cachedArchive, filename);

  if (isWin) {
    execSync(`powershell -command "Expand-Archive -Path '${cachedArchive}' -DestinationPath '${cacheDir}' -Force"`, { stdio: "inherit" });
  } else {
    execSync(`tar xzf "${cachedArchive}" -C "${cacheDir}"`, { stdio: "inherit" });
  }
  try { fs.unlinkSync(cachedArchive); } catch {}
  console.log("[build-server] Node.js cached");
} else {
  console.log(`[build-server] using cached Node.js ${NODE_VERSION}`);
}

// 复制 node 二进制为 openshadow-server.exe（Windows）或 node（其他平台）
const destNode = path.join(outDir, isWin ? "openshadow-server.exe" : "node");
fs.copyFileSync(cachedNodeBin, destNode);
if (!isWin) fs.chmodSync(destNode, 0o755);
console.log("[build-server] Node.js runtime ready");

// helper: 用目标 Node 跑命令
const targetNodeDir = path.dirname(cachedNodeBin);
const targetEnv = {
  ...process.env,
  NODE_ENV: "production",
  PATH: `${targetNodeDir}${path.delimiter}${process.env.PATH}`,
};
function runWithTargetNode(cmd, opts = {}) {
  execSync(`"${cachedNodeBin}" ${cmd}`, {
    cwd: outDir,
    stdio: "inherit",
    env: targetEnv,
    ...opts,
  });
}

// ── 2. Vite bundle ──
console.log("[build-server] running Vite bundle...");
execSync("npx vite build --config vite.config.server.js", { cwd: ROOT, stdio: "inherit" });

const bundleOutDir = path.join(outDir, "bundle");
fs.cpSync(path.join(ROOT, "dist-server-bundle"), bundleOutDir, { recursive: true });
console.log("[build-server] Vite bundle copied to bundle/");

// ── 3. Bootstrap ──
// 适配 openshadow：读取 SHADOW_HOME / OPENSHADOW_HOME 环境变量
fs.writeFileSync(path.join(outDir, "bootstrap.js"), [
  'import path from "path";',
  'import { pathToFileURL } from "url";',
  'const shadowRoot = import.meta.dirname;',
  'const serverEntry = path.join(shadowRoot, "bundle", "index.js");',
  `console.log(\`[bootstrap] pid=\${process.pid} node=\${process.version}\`);`,
  `console.log(\`[bootstrap] root=\${shadowRoot} entry=\${serverEntry}\`);`,
  `console.log(\`[bootstrap] SHADOW_HOME=\${process.env.SHADOW_HOME || "unset"}\`);`,
  "await import(pathToFileURL(serverEntry).href);",
  "",
].join("\n"));
console.log("[build-server] bootstrap created");

// ── 4. External dependencies ──
const rootPkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"));
const viteConfig = (await import("../vite.config.server.js")).default;
const viteExternals = viteConfig.build?.rollupOptions?.external || [];
const builtinSet = new Set(builtinModules.flatMap(m => [m, `node:${m}`]));
const deps = rootPkg.dependencies || {};
const externalDeps = {};

for (const ext of viteExternals) {
  if (typeof ext === "string") {
    if (builtinSet.has(ext)) continue;
    if (deps[ext]) externalDeps[ext] = deps[ext];
  } else if (ext instanceof RegExp) {
    for (const dep of Object.keys(deps)) {
      if (ext.test(dep)) externalDeps[dep] = deps[dep];
    }
  }
}

console.log(`[build-server] external deps: ${Object.keys(externalDeps).join(", ")}`);

// Pin versions from root lockfile
const rootLock = JSON.parse(fs.readFileSync(path.join(ROOT, "package-lock.json"), "utf-8"));
const pinnedDeps = {};
for (const packageName of Object.keys(externalDeps)) {
  const pkgPath = `node_modules/${packageName}`;
  const locked = rootLock?.packages?.[pkgPath];
  pinnedDeps[packageName] = locked?.version || externalDeps[packageName];
}

// jsdom requires lru-cache at runtime
if (pinnedDeps["jsdom"]) {
  const lruCachePath = "node_modules/lru-cache";
  const lockedLru = rootLock?.packages?.[lruCachePath];
  if (lockedLru?.version) pinnedDeps["lru-cache"] = lockedLru.version;
}

const serverPkg = {
  name: "openshadow-server",
  version: rootPkg.version,
  type: "module",
  dependencies: pinnedDeps,
};
fs.writeFileSync(path.join(outDir, "package.json"), JSON.stringify(serverPkg, null, 2) + "\n");
console.log(`[build-server] pinned deps: ${Object.entries(pinnedDeps).map(([n,v])=>`${n}@${v}`).join(", ")}`);

// ── 5. 用目标 Node 安装依赖 — 关键步骤！native addon 编译到正确 ABI ──
console.log("[build-server] installing external deps with target Node.js...");
runWithTargetNode(`"${cachedNpmCli}" install --omit=dev --no-audit --no-fund`);

// ── 6. 验证 ──
const nmDir = path.join(outDir, "node_modules");
const criticalFiles = [
  "better-sqlite3/build/Release/better_sqlite3.node",
  "ws/package.json",
  "qrcode/package.json",
];
for (const f of criticalFiles) {
  if (!fs.existsSync(path.join(nmDir, f))) {
    console.error(`[build-server] ❌ Missing: node_modules/${f}`);
    process.exit(1);
  }
}

// 验证 external 包都能 import
const missing = [];
for (const ext of viteExternals) {
  if (typeof ext !== "string" || builtinSet.has(ext) || ext === "fsevents") continue;
  if (!fs.existsSync(path.join(nmDir, ext))) missing.push(ext);
}
if (missing.length > 0) {
  console.error(`[build-server] ❌ Missing external packages: ${missing.join(", ")}`);
  process.exit(1);
}

// ── 7. 清理 .bin 目录（符号链接在打包时会导致 codesign 报错）──
const topBin = path.join(nmDir, ".bin");
if (fs.existsSync(topBin)) fs.rmSync(topBin, { recursive: true });
for (const entry of fs.readdirSync(nmDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const nested = path.join(nmDir, entry.name, "node_modules", ".bin");
  if (fs.existsSync(nested)) fs.rmSync(nested, { recursive: true });
}

console.log("[build-server] ✅ Done!");
console.log(`[build-server] Output: ${outDir}`);

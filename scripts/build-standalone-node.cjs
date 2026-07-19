#!/usr/bin/env node
/**
 * build-standalone-node.cjs — 为 Windows 安装包产出独立 Node.js 运行时
 *
 * 背景：server 的 native addon（better-sqlite3 / node-pty / @node-rs/jieba）
 * 必须与运行时 Node 的 ABI 一致。项目中这些 addon 用 Node 22.22.2（ABI 127）
 * 编译，因此打包必须用「同一 ABI 的 Node」跑 server，否则启动即
 * ERR_MODULE_NOT_FOUND / 原生模块加载崩溃。
 *
 * 旧版把 server 直接交给 Electron 内置 Node（ABI 不匹配）→ 崩溃；
 * 手动放 standalone node 又不可复现。本脚本把「下载并固定 ABI 的 Node」
 * 变成 build 的一步，使其可复现、可重装不复发。
 *
 * 产出：dist-server/win-x64/openshadow-server.exe  +  bootstrap.js
 * electron-builder 通过 extraResources { from: "dist-server/win-x64", to: "server" }
 * 把它塞进 resources/server/。server-manager.cjs 的 resolveServerLaunch
 * 检测到 openshadow-server.exe 即走独立 Node 路径，bootstrap.js 加载
 * ../server-bundle/index.js（与已验证可用的安装包完全一致）。
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { createHash } = require('crypto');

const ROOT = path.resolve(__dirname, '..');

const platform = process.argv[2] || process.platform;
const arch = process.argv[3] || process.arch;

// 仅 Windows 安装包需要独立 Node（resolveServerLaunch 只在 win32 走此路径）
if (platform !== 'win32' || arch !== 'x64') {
  console.log(
    `[build-standalone-node] skipping: standalone node only needed for win32-x64 (got ${platform}-${arch})`,
  );
  process.exit(0);
}

// 与项目 native addon 编译所用的 Node 保持同一 ABI（22.22.2 → ABI 127）
const NODE_VERSION = 'v22.22.2';
const NODE_ZIP = `node-${NODE_VERSION}-win-x64.zip`;
// 来自 https://nodejs.org/dist/v22.22.2/SHASUMS256.txt
const NODE_ZIP_SHA256 = '7c93e9d92bf68c07182b471aa187e35ee6cd08ef0f24ab060dfff605fcc1c57c';

const cacheDir = path.join(ROOT, '.cache', 'node-runtime');
fs.mkdirSync(cacheDir, { recursive: true });

const outDir = path.join(ROOT, 'dist-server', 'win-x64');
fs.mkdirSync(outDir, { recursive: true });
const destExe = path.join(outDir, 'openshadow-server.exe');

function verifySha256(filePath) {
  const actual = createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  if (actual !== NODE_ZIP_SHA256) {
    try { fs.rmSync(filePath, { force: true }); } catch {}
    throw new Error(
      `Node runtime zip checksum mismatch: expected ${NODE_ZIP_SHA256}, got ${actual}`,
    );
  }
  console.log('[build-standalone-node] checksum verified');
}

function findNodeExe(dir) {
  let found = null;
  const walk = (d) => {
    if (found) return;
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name === 'node.exe') { found = full; return; }
    }
  };
  walk(dir);
  return found;
}

function extractExeFromZip(zipPath, outExe) {
  const tmp = path.join(cacheDir, 'node-extract-tmp');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  execSync(
    `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tmp}' -Force"`,
    { stdio: 'inherit' },
  );
  // Node 的 win zip 把文件放在 node-vX.Y.Z-win-x64/ 子目录里，需递归定位 node.exe
  const srcExe = findNodeExe(tmp);
  if (!srcExe) throw new Error(`node.exe not found after extracting ${zipPath}`);
  fs.copyFileSync(srcExe, outExe);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('[build-standalone-node] extracted node.exe -> openshadow-server.exe');
}

function downloadNode() {
  const cached = path.join(cacheDir, NODE_ZIP);
  if (!fs.existsSync(cached)) {
    const url = `https://nodejs.org/dist/${NODE_VERSION}/${NODE_ZIP}`;
    console.log(`[build-standalone-node] downloading ${url}`);
    execSync(`curl --fail --location --show-error -o "${cached}" "${url}"`, { stdio: 'inherit' });
  }
  verifySha256(cached);
  extractExeFromZip(cached, destExe);
}

function fallbackToLocalNode() {
  // 离线兜底：复制本机已存在的 Node 22.22.2 二进制（ABI 127，与项目 addon 一致）
  const candidates = [
    'C:\\Users\\wangshuaibj\\.workbuddy\\binaries\\node\\versions\\22.22.2\\node.exe',
    process.env.LOCALAPPDATA &&
      path.join(process.env.LOCALAPPDATA, 'Programs', 'OpenShadow', 'resources', 'server', 'openshadow-server.exe'),
  ].filter(Boolean);
  for (const c of candidates) {
    if (!fs.existsSync(c)) continue;
    try {
      const v = execSync(`"${c}" --version`).toString().trim();
      if (v === NODE_VERSION) {
        fs.copyFileSync(c, destExe);
        console.log(`[build-standalone-node] fallback: copied local ${c} (${v})`);
        return true;
      }
      console.warn(`[build-standalone-node] local node ${c} is ${v}, expected ${NODE_VERSION}; skipping`);
    } catch {}
  }
  return false;
}

// 增量：已存在且体积正常则跳过
if (fs.existsSync(destExe) && fs.statSync(destExe).size > 10_000_000) {
  console.log('[build-standalone-node] openshadow-server.exe already present, skipping');
} else {
  try {
    downloadNode();
  } catch (e) {
    console.warn(`[build-standalone-node] download failed: ${e.message}`);
    if (!fallbackToLocalNode()) {
      throw new Error(
        '[build-standalone-node] could not obtain standalone Node 22.22.2 (download failed and no local fallback)',
      );
    }
  }
}

// 写 bootstrap.js（加载 ../server-bundle/index.js —— 与已验证可用的安装包一致）
const bootstrapPath = path.join(outDir, 'bootstrap.js');
const bootstrapContent = `// resources/server/bootstrap.js
// Standalone Node.js bootstrap for the OpenShadow server.
// openshadow-server.exe 是 ABI 与 server-bundle 的 native addon 匹配的独立 Node
// 运行时，本文件用动态 import 加载 ../server-bundle/index.js（ESM server bundle）。
const path = require('path')
const { pathToFileURL } = require('url')

const target = path.join(__dirname, '..', 'server-bundle', 'index.js')
import(pathToFileURL(target).href)
  .then(() => {
    // server started; index.js runs the HTTP server
  })
  .catch((err) => {
    console.error('[openshadow-server-bootstrap] failed to load', target, err)
    process.exit(1)
  })
`;
fs.writeFileSync(bootstrapPath, bootstrapContent);
console.log('[build-standalone-node] bootstrap.js written');

// 自清洁：只保留两个产物，清除任何遗留杂项（如历史 build:standalone 残留的 node_modules）。
// 否则 extraResources 会把整个 dist-server/win-x64 塞进安装包，凭空多出数百 MB  junk。
const KEEP = new Set(['openshadow-server.exe', 'bootstrap.js']);
for (const entry of fs.readdirSync(outDir)) {
  if (!KEEP.has(entry)) {
    fs.rmSync(path.join(outDir, entry), { recursive: true, force: true });
    console.log(`[build-standalone-node] cleaned stray artifact: ${entry}`);
  }
}

console.log('[build-standalone-node] Done: dist-server/win-x64/{openshadow-server.exe,bootstrap.js}');

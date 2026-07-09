/**
 * 对齐 openhanako：生成 dist-server-bundle/package.json
 * 依赖列表来自 vite.config.server.js 的 external（不含 node builtins）
 *
 * 关键修复：不仅声明顶层 external，还把它们的【完整传递依赖闭包】一并声明为
 * server-bundle 的直接依赖。否则打包期 afterPack 的 `npm install` 在离线/缓存
 * 不完整时会漏装传递依赖（如 @mariozechner/pi-ai → partial-json），导致 server
 * 启动即崩 (ERR_MODULE_NOT_FOUND)，进而首页拉不到任何 API。
 */
const { writeFileSync, mkdirSync, existsSync, readFileSync } = require('fs');
const { resolve } = require('path');
const { builtinModules } = require('module');

const root = resolve(__dirname, '..');
const rootPkg = require(resolve(root, 'package.json'));
const deps = rootPkg.dependencies || {};
let rootLock = {};
try { rootLock = require(resolve(root, 'package-lock.json')); } catch {}

// vite.config.server.js 的 external 列表（非 node builtin 部分）
const serverExternals = [
  '@node-rs/jieba', 'better-sqlite3', 'node-pty', 'ws',
  '@mariozechner/pi-ai', '@mariozechner/pi-coding-agent',
  '@silvia-odwyer/photon-node', '@larksuiteoapi/node-sdk',
  'node-telegram-bot-api', 'proxy-agent', 'undici',
  'exceljs', 'mammoth', 'jsdom', 'qrcode',
];
// fsevents 仅 macOS，Windows/Linux 跳过

const builtins = new Set(builtinModules);

function readInstalledVersion(pkg) {
  try {
    const pj = resolve(root, 'node_modules', pkg, 'package.json');
    if (existsSync(pj)) return JSON.parse(readFileSync(pj, 'utf-8')).version;
  } catch {}
  return null;
}

function resolveVersion(pkg) {
  const lp = rootLock.packages?.[`node_modules/${pkg}`];
  return lp?.version || deps[pkg] || readInstalledVersion(pkg) || 'latest';
}

// 收集 external 的完整传递依赖闭包（只走 dependencies，不碰 dev/optional）
const pinned = {};
function collectTransitive(pkgName, seen) {
  if (seen.has(pkgName)) return;
  seen.add(pkgName);
  if (!pinned[pkgName]) pinned[pkgName] = resolveVersion(pkgName);
  const entry = rootLock.packages?.[`node_modules/${pkgName}`];
  const subDeps = entry?.dependencies;
  if (!subDeps) return;
  for (const dep of Object.keys(subDeps)) {
    if (builtins.has(dep)) continue;
    if (!seen.has(dep)) collectTransitive(dep, seen);
  }
}

const seed = new Set(serverExternals);
for (const pkg of seed) collectTransitive(pkg, new Set());

const serverPkg = { name: 'openshadow-server-deps', private: true, dependencies: pinned };
const bundleDir = resolve(root, 'dist-server-bundle');
mkdirSync(bundleDir, { recursive: true });
writeFileSync(resolve(bundleDir, 'package.json'), JSON.stringify(serverPkg, null, 2));
console.log(`[copy-deps] ${Object.keys(pinned).length} deps (top-level externals + transitive closure) in package.json`);
for (const [k, v] of Object.entries(pinned)) console.log(`  ${k}@${v}`);

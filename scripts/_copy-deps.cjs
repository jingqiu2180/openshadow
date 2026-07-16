/**
 * 对齐 openhanako：生成 dist-server-bundle/package.json
 * 依赖列表来自 vite.config.server.js 的 external（不含 node builtins）
 *
 * 关键修复：不仅声明顶层 external，还把它们的【完整传递依赖闭包】一并声明为
 * server-bundle 的直接依赖。否则打包期 afterPack 的 `npm install` 在离线/缓存
 * 不完整时会漏装传递依赖（如 @earendil-works/pi-ai → partial-json），导致 server
 * 启动即崩 (ERR_MODULE_NOT_FOUND)，进而首页拉不到任何 API。
 */
const { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } = require('fs');
const { resolve } = require('path');
const { builtinModules } = require('module');

const root = resolve(__dirname, '..');
const rootPkg = require(resolve(root, 'package.json'));
const deps = rootPkg.dependencies || {};
let rootLock = {};
try { rootLock = require(resolve(root, 'package-lock.json')); } catch {}

// vite.config.server.js 的 external 列表（非 node builtin 部分）。
// ⚠️ 必须与 vite.config.server.js 的 rollupOptions.external 严格同步维护：
// 这里列出的每个 string external 都要求落到 server-bundle 的 node_modules 里，
// 否则运行时 import 会 ERR_MODULE_NOT_FOUND 导致 server 启动即崩。
const viteExternals = [
  '@node-rs/jieba', 'better-sqlite3', 'node-pty', 'ws',
  '@silvia-odwyer/photon-node', '@larksuiteoapi/node-sdk',
  'node-telegram-bot-api', 'proxy-agent', 'undici',
  'exceljs', 'mammoth', 'jsdom', 'qrcode',
  // ⚠️ @mariozechner/clipboard 是 @earendil-works/pi-coding-agent 0.80.3 的
  // optionalDependencies（真实传递依赖，0.80.3 依赖树仍存在），必须随闭包复制进
  // server-bundle，否则运行时 require('@mariozechner/clipboard') 会
  // ERR_MODULE_NOT_FOUND（clipboard 内部再 require 平台原生包 win32-x64-msvc）。
  '@mariozechner/clipboard', '@mariozechner/clipboard-win32-x64-msvc',
];
// fsevents 仅 macOS 需要（Windows/Linux 跳过，vite 也仅在 mac 打包时 external）。
if (process.platform === 'darwin') viteExternals.push('fsevents');

// vite 把 /^@earendil-works\// 与 /^@mariozechner\// 作为 RegExp external ——
// 展开为 node_modules 下所有对应 scope 的包，确保 Pi SDK 全家桶 + clipboard
// 都进闭包（对齐 vite 行为）。
function listScopePackages(scope) {
  const dir = resolve(root, 'node_modules', scope);
  const out = [];
  try {
    for (const name of readdirSync(dir)) {
      if (existsSync(resolve(dir, name, 'package.json'))) out.push(`${scope}/${name}`);
    }
  } catch { /* 无该作用域 */ }
  return out;
}

const serverExternals = [
  ...viteExternals,
  ...listScopePackages('@earendil-works'),
  ...listScopePackages('@mariozechner'),
];

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

// 收集 external 的完整传递依赖闭包。
//
// 策略（v3，修复 v2 嵌套依赖系统性漏包）：
//   以 package-lock.json 追踪为主（lock 文件包含 npm 解析后的完整平坦依赖图，
//   不受 nested/hoisting 布局影响），文件系统仅做版本回退。
//
//   v2 用"从物理路径逐级向上读 package.json 递归"的方式收集，
//   但对 openai 等深层嵌套树（_shims 子目录、多层 nested node_modules）
//   有系统性遗漏——实测漏掉 formdata-node/abort-controller/agentkeepalive 等
//   6+ 个运行时真依赖。改用 lock 追踪后一次性解决。
const pinned = {};

function resolveVersion(pkg) {
  const lp = rootLock.packages?.[`node_modules/${pkg}`];
  return lp?.version || deps[pkg] || readInstalledVersion(pkg) || 'latest';
}

// ── Lock 文件追踪（主路径）──
// 从 package-lock.json 的平坦依赖图递归收集，不受 nested/hoisting 布局影响。
// 这是 npm 自己解析出的完整传递闭包，比文件系统逐级查找更可靠。
const lockVisited = new Set();
function traceFromLock(pkgName) {
  if (lockVisited.has(pkgName)) return;
  if (builtins.has(pkgName)) return;
  lockVisited.add(pkgName);
  if (!pinned[pkgName]) pinned[pkgName] = resolveVersion(pkgName);
  const entry = rootLock.packages?.[`node_modules/${pkgName}`];
  const subDeps = entry?.dependencies || entry?.requires || {};
  for (const dep of Object.keys(subDeps)) {
    traceFromLock(dep);
  }
}

// ── 文件系统兜底（补充 lock 可能缺失的包）──
// 某些包（如平台原生包 clipboard-win32-x64-msvc）可能不在 lock 的标准位置，
// 通过物理目录扫描补录。仅用于版本定位，不做依赖递归。
function fallbackPhysScan(pkgName, fromDir) {
  if (pinned[pkgName]) return;
  let cur = fromDir;
  while (true) {
    const cand = resolve(cur, 'node_modules', pkgName);
    try {
      const pj = JSON.parse(readFileSync(resolve(cand, 'package.json'), 'utf-8'));
      pinned[pkgName] = pj.version || resolveVersion(pkgName);
      return;
    } catch { /* not found here */ }
    const parent = resolve(cur, '..');
    if (parent === cur || parent.length < root.length) break;
    cur = parent;
  }
}

// 执行收集：先 lock 追踪，再 phys 兜底补漏
for (const pkg of serverExternals) {
  traceFromLock(pkg);
  fallbackPhysScan(pkg, root); // 确保自身在位（如 @earendil-works/* 子包）
}

// ── 嵌套依赖兜底（lock 看不到的 nested vN 依赖 + 包自声明 deps）──
// lock 只记录每个包名的一个版本（顶层 hoisted 版），但运行时实际加载的是
// 物理嵌套的旧版（如 lazystream→readable-stream@2→process-nextick-args，
// glob→brace-expansion@1→concat-map，binary→chainsaw）。这些嵌套版的 deps
// 与 hoisted 版不同，lock 追踪会漏。这里对每个已收集包：
//   ① 读其 package.json 自声明 deps（如 binary 声明 chainsaw/buffers）
//   ② 扫其物理 node_modules/ 下的嵌套包
// 统一按"物理存在即纳入"原则补齐，递归到稳定。
function resolvePhys(pkgName, fromDir) {
  let cur = fromDir;
  while (true) {
    const cand = resolve(cur, 'node_modules', pkgName);
    if (existsSync(resolve(cand, 'package.json'))) return cand;
    const parent = resolve(cur, '..');
    if (parent === cur || parent.length < root.length) break;
    cur = parent;
  }
  return null;
}
// BFS：从已有闭包出发，递归补齐每个包"物理现实"所需的依赖
const queue = Object.keys(pinned);
const processed = new Set();
while (queue.length > 0) {
  const pkg = queue.shift();
  if (processed.has(pkg)) continue;
  processed.add(pkg);
  const phys = resolve(root, 'node_modules', pkg);
  if (!existsSync(phys)) continue;
  // ① 读 package.json 自声明 deps
  try {
    const { dependencies: selfDeps } = JSON.parse(readFileSync(resolve(phys, 'package.json'), 'utf-8'));
    if (selfDeps) {
      for (const dep of Object.keys(selfDeps)) {
        if (builtins.has(dep) || pinned[dep]) continue;
        const depPhys = resolvePhys(dep, phys);
        if (depPhys) {
          const v = JSON.parse(readFileSync(resolve(depPhys, 'package.json'), 'utf-8')).version;
          pinned[dep] = v || resolveVersion(dep);
          queue.push(dep); // 继续递归其依赖
        }
      }
    }
  } catch { /* ignore */ }
  // ② 扫物理 node_modules/ 下的嵌套包
  try {
    const nmPath = resolve(phys, 'node_modules');
    if (existsSync(nmPath)) {
      for (const sub of readdirSync(nmPath, { withFileTypes: true })) {
        if (!sub.isDirectory()) continue;
        const subPj = resolve(nmPath, sub.name, 'package.json');
        if (!existsSync(subPj)) continue;
        if (builtins.has(sub.name) || pinned[sub.name]) continue;
        const v = JSON.parse(readFileSync(subPj, 'utf-8')).version;
        pinned[sub.name] = v || resolveVersion(sub.name);
        queue.push(sub.name); // 继续递归
      }
    }
  } catch { /* ignore */ }
}

// 硬校验（对齐 openhanako build-server.mjs 的 external 缺失 exit(1)）：
// 每个显式 string external 必须落入闭包，否则视为打包配置错误 —— 漏一个
// 就会在运行时 import 失败、server 启动即崩，比静默少装更易在构建期暴露。
// fsevents 仅在 macOS 安装，非 mac 平台允许缺失。
const missingExternals = viteExternals.filter((e) => !pinned[e]);
if (missingExternals.length > 0) {
  throw new Error(
    `[copy-deps] 以下 vite external 未被闭包收集到（检查 package-lock.json / node_modules 是否完整安装）: ${missingExternals.join(', ')}`,
  );
}

const serverPkg = { name: 'openshadow-server-deps', private: true, dependencies: pinned };
const bundleDir = resolve(root, 'dist-server-bundle');
mkdirSync(bundleDir, { recursive: true });
writeFileSync(resolve(bundleDir, 'package.json'), JSON.stringify(serverPkg, null, 2));
console.log(`[copy-deps] ${Object.keys(pinned).length} deps (top-level externals + transitive closure) in package.json`);
for (const [k, v] of Object.entries(pinned)) console.log(`  ${k}@${v}`);

/**
 * fix-modules.cjs — electron-builder afterPack 钩子
 *
 * electron-builder 的依赖分析有时会漏掉新的子依赖。
 * 这个脚本在打包后重建独立 server 的 node_modules，并检查启动期
 * 必需的外部依赖已经落进最终资源目录。
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const {
  CRITICAL_BUNDLED_EXTERNALS,
} = require("../desktop/src/shared/server-readiness.cjs");

const SERVER_NODE_MODULE_REQUIRED_FILES = [
  ...CRITICAL_BUNDLED_EXTERNALS.map((pkg) => `${pkg}/package.json`),
  "better-sqlite3/build/Release/better_sqlite3.node",
];

function resolveNodeModuleFile(nodeModulesDir, relativePath) {
  return path.join(nodeModulesDir, ...relativePath.split("/"));
}

function missingBundledServerNodeModuleFiles(nodeModulesDir) {
  const missing = [];
  for (const relativePath of SERVER_NODE_MODULE_REQUIRED_FILES) {
    try {
      fs.accessSync(resolveNodeModuleFile(nodeModulesDir, relativePath), fs.constants.R_OK);
    } catch {
      missing.push(`node_modules/${relativePath}`);
    }
  }
  return missing;
}

function assertBundledServerNodeModulesReady(nodeModulesDir) {
  const missing = missingBundledServerNodeModuleFiles(nodeModulesDir);
  if (missing.length > 0) {
    throw new Error(
      `[fix-modules] Packaged server node_modules is incomplete: ${missing.join(", ")}`,
    );
  }
}

function copyBundledServerNodeModules(serverDir, serverBuildModules, opts = {}) {
  if (!fs.existsSync(serverDir)) {
    throw new Error(
      `[fix-modules] Packaged server directory is missing: ${serverDir}. ` +
      "Run npm run build:server before electron-builder.",
    );
  }

  if (!fs.existsSync(serverBuildModules)) {
    throw new Error(
      `[fix-modules] Built server node_modules is missing: ${serverBuildModules}. ` +
      "Run npm run build:server before electron-builder.",
    );
  }

  const serverNodeModules = path.join(serverDir, "node_modules");
  fs.rmSync(serverNodeModules, { recursive: true, force: true });
  fs.cpSync(serverBuildModules, serverNodeModules, { recursive: true });
  assertBundledServerNodeModulesReady(serverNodeModules);

  const log = typeof opts.log === "function" ? opts.log : console.log;
  log(`[fix-modules] 重建 server node_modules → ${serverNodeModules}`);
}

// 清理 node_modules 中指向 bundle 外部的 .bin 符号链接（codesign 会报错 / 运行时 dangling）。
// boundary 为 bundle 根目录：绝对路径且不在 boundary 内的 .bin 软链会被删除。
// 抽成模块级函数，供 server-bundle 与 dist app 两处复用。返回删除的符号链接数量。
function cleanBinLinks(dir, boundary) {
  let removed = 0;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return removed; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      const linkTarget = fs.readlinkSync(full);
      if (path.isAbsolute(linkTarget) && boundary && !linkTarget.startsWith(boundary)) {
        fs.unlinkSync(full);
        removed++;
      }
    } else if (entry.isDirectory() && entry.name !== ".bin") {
      const binDir = path.join(full, "node_modules", ".bin");
      if (fs.existsSync(binDir)) removed += cleanBinLinks(binDir, boundary);
    }
  }
  return removed;
}

// 剔除 server-bundle/node_modules 中的 devDependencies。
// 整拷根 node_modules 后，根 package.json 里声明的 devDependencies（vite / electron /
// typescript / esbuild / @types/* / vitest / @electron/* 等，运行时完全不需要）仍被
// 一并拷了进来，使 server-bundle 体积膨胀到 ~1.3GB / 安装解压 ~965MB。Windows Defender
// 实时防护逐个扫描这些海量小文件会把 NSIS 安装拖到“假死”。这里在整拷后把 devDep 顶层
// 目录删掉，大幅瘦身；运行时需要的生产依赖闭包（ws / hono / @mariozechner/* /
// partial-json / better-sqlite3 / node-pty …）全部保留，server 仍能正常启动。
function pruneDevDependencies(serverDir, rootPackageJsonPath, opts = {}) {
  let rootPkg;
  try {
    rootPkg = JSON.parse(fs.readFileSync(rootPackageJsonPath, "utf-8"));
  } catch {
    return; // 读不到根 package.json 就跳过，不阻塞打包
  }
  const devDeps = Object.keys(rootPkg.devDependencies || {});
  if (devDeps.length === 0) return;
  const target = path.join(serverDir, "node_modules");
  const log = typeof opts.log === "function" ? opts.log : console.log;
  let removed = 0;
  for (const dep of devDeps) {
    const p = path.join(target, dep);
    if (fs.existsSync(p)) {
      fs.rmSync(p, { recursive: true, force: true });
      removed++;
    }
  }
  // 清理被删 dev 包遗留的 .bin 软链（相对指向已删文件 → dangling）
  const topBin = path.join(target, ".bin");
  if (fs.existsSync(topBin)) {
    for (const b of fs.readdirSync(topBin, { withFileTypes: true })) {
      if (!b.isSymbolicLink()) continue;
      const bp = path.join(topBin, b.name);
      try {
        const t = fs.readlinkSync(bp);
        if (!fs.existsSync(path.resolve(topBin, t))) fs.unlinkSync(bp);
      } catch {
        /* ignore */
      }
    }
  }
  log(`[fix-modules] 剔除 ${removed} 个 devDependencies（减小包体积，加速安装/更新）`);
}

// 从项目根已完整安装好的 node_modules 整拷进 server-bundle/node_modules。
// 这是经过本地验证（junction 到完整 node_modules 后 server 正常返回 health 200）
// 的最稳妥方案：server 以 ESM 直接 `node resources/server-bundle/index.js` 运行，
// 任意 bare import（hono / partial-json / ws / @mariozechner/* 等）都必须能在
// server-bundle/node_modules 解析。仅按 server-bundle/package.json 声明拷贝会在依赖
// 闭包不全时漏装传递依赖（如 @mariozechner/pi-ai → partial-json、或 _copy-deps.cjs
// 未收录的 indirect 依赖），导致 server 启动即 ERR_MODULE_NOT_FOUND 崩溃
// （server 未就绪 → 模型配置无法推送 → 首页“模型未生效 / server 未就绪”）。
// 整拷根 node_modules 保证 100% 完整、可复现，且 native addon 已针对本平台编译；
// 随后 pruneDevDependencies 剔除 devDep 大幅瘦身（见上）。
function rebuildServerNodeModulesFromProject(serverDir, projectModules, opts = {}) {
  const target = path.join(serverDir, "node_modules");
  const log = typeof opts.log === "function" ? opts.log : console.log;
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });

  const entries = fs.readdirSync(projectModules, { withFileTypes: true });
  for (const entry of entries) {
    const src = path.join(projectModules, entry.name);
    const dest = path.join(target, entry.name);
    fs.cpSync(src, dest, { recursive: true });
  }
  log(`[fix-modules] 重建 server node_modules → ${target}（整拷根 node_modules，共 ${entries.length} 个顶层条目）`);

  // 剔除 devDependencies 瘦身（关键：避免安装包过大导致 NSIS 解压被 Defender 拖死）
  pruneDevDependencies(serverDir, path.resolve(__dirname, "..", "package.json"), opts);

  // 关键依赖兜底校验：防止漏装导致 server 启动即崩
  const requiredServerDeps = ["@mariozechner/pi-ai", "partial-json", "ws", "hono"];
  const stillMissing = requiredServerDeps.filter(
    (p) => !fs.existsSync(path.join(target, p, "package.json")),
  );
  if (stillMissing.length > 0) {
    throw new Error(`[fix-modules] server-bundle 缺少关键依赖: ${stillMissing.join(", ")}`);
  }

  // 清理指向 bundle 外部的 .bin 符号链接（codesign / 运行时 dangling）
  const topBin = path.join(target, ".bin");
  if (fs.existsSync(topBin)) cleanBinLinks(topBin, serverDir);
}

exports.default = async function (context) {
  const platformName = context.packager.platform.name;
  const arch = context.arch === 1 ? "x64" : context.arch === 3 ? "arm64" : "x64";
  const appDir = platformName === "mac"
    ? path.join(context.appOutDir, context.packager.appInfo.productFilename + ".app",
        "Contents", "Resources", "app")
    : path.join(context.appOutDir, "resources", "app");
  const distModules = path.join(appDir, "node_modules");
  const localModules = path.resolve(__dirname, "..", "node_modules");

  // ── server runtime deps 重建 ──
  // electron-builder 的 extraResources 会过滤 node_modules，
  // 这里手动把 build-server 产出的 node_modules 复制到 server 目录
  const resourcesDir = platformName === "mac"
    ? path.join(context.appOutDir, context.packager.appInfo.productFilename + ".app",
        "Contents", "Resources")
    : path.join(context.appOutDir, "resources");
  if (platformName === "mac") {
    const computerUseHelper = path.join(resourcesDir, "computer-use", "macos", "hana-computer-use-helper");
    if (!fs.existsSync(computerUseHelper)) {
      // 本仓库没有 build-computer-use-helper.mjs，CI 不会产出该 helper。
      // 缺失时仅让 Computer Use 特性在运行时降级，不阻塞打包，否则 macOS 腿必挂。
      console.warn(
        `[fix-modules] WARNING: Computer Use helper not found at ${computerUseHelper}. ` +
          "Computer Use feature will be unavailable at runtime. Skipping (non-fatal).",
      );
    } else {
      const mode = fs.statSync(computerUseHelper).mode;
      if ((mode & 0o111) === 0) {
        throw new Error(`[fix-modules] Computer Use helper is not executable: ${computerUseHelper}`);
      }
    }
  }
  const serverDir = path.join(resourcesDir, "server-bundle");

  // 关键修复：不再在 server-bundle 内 npm install（CI 缓存不全时
  // `--prefer-offline` 只会装上缓存里残留的少数包，导致 server 启动即
  // ERR_MODULE_NOT_FOUND 崩溃）。改为直接从项目根已完整安装好的 node_modules
  // 复制 server-bundle/package.json 声明的全部依赖（含 native addon）。
  const serverPkgPath = path.join(serverDir, "package.json");
  if (fs.existsSync(serverPkgPath)) {
    rebuildServerNodeModulesFromProject(serverDir, localModules);

    // 修补 @mariozechner/* 包的 package.json `exports`：
    // 这些包（如 pi-coding-agent 0.70.2）的 exports 字段未声明打包 bundle
    // 引用的内部子路径（如 ./dist/utils/image-resize.js）。external 化后，
    // 运行时 Node 会抛 ERR_PACKAGE_PATH_NOT_EXPORTED 导致 server 启动即崩。
    // 这里补全通配子路径映射，使深层 import 在运行时可解析。
    const marioDir = path.join(serverDir, "node_modules", "@mariozechner");
    if (fs.existsSync(marioDir)) {
      for (const pkg of fs.readdirSync(marioDir)) {
        const pkgJson = path.join(marioDir, pkg, "package.json");
        if (!fs.existsSync(pkgJson)) continue;
        let p;
        try { p = JSON.parse(fs.readFileSync(pkgJson, "utf-8")); } catch { continue; }
        if (!p.exports || typeof p.exports !== "object") continue;
        const patterns = ["./*", "./dist/*", "./dist/utils/*", "./dist/core/*", "./dist/llm/*"];
        let changed = false;
        for (const k of patterns) {
          if (!(k in p.exports)) { p.exports[k] = k; changed = true; }
        }
        if (changed) {
          fs.writeFileSync(pkgJson, JSON.stringify(p, null, 2));
          console.log(`[fix-modules] patched exports for @mariozechner/${pkg}`);
        }
      }
    }
  }

  if (!fs.existsSync(distModules)) return;

  // 获取生产依赖树
  let prodDeps;
  try {
    const raw = execSync("npm ls --all --json --omit=dev", {
      cwd: path.resolve(__dirname, ".."),
      maxBuffer: 20 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    });
    prodDeps = JSON.parse(raw);
  } catch (e) {
    // npm ls 在有 peer dep 警告时也会 exit 1，但 stdout 仍有数据
    try {
      prodDeps = JSON.parse(e.stdout?.toString() || "{}");
    } catch {
      console.log("[fix-modules] 无法解析依赖树，跳过");
      return;
    }
  }

  function collectDeps(obj, set = new Set()) {
    if (!obj || !obj.dependencies) return set;
    for (const [name, info] of Object.entries(obj.dependencies)) {
      set.add(name);
      collectDeps(info, set);
    }
    return set;
  }

  const allProd = collectDeps(prodDeps);
  let copied = 0;

  // 含 native binding 的包（需要平台匹配编译），补全时额外警告
  const NATIVE_PACKAGES = new Set(["bufferutil", "utf-8-validate"]);

  for (const dep of allProd) {
    const distPath = path.join(distModules, dep);
    const localPath = path.join(localModules, dep);
    if (!fs.existsSync(distPath) && fs.existsSync(localPath)) {
      if (NATIVE_PACKAGES.has(dep)) {
        console.warn(`[fix-modules] ⚠ 补全 native 包 "${dep}"（确保已针对当前平台编译）`);
      }
      fs.cpSync(localPath, distPath, { recursive: true });
      copied++;
    }
  }

  if (copied > 0) {
    console.log(`[fix-modules] 补全了 ${copied} 个缺失的生产依赖`);
  }

  // 清理 app node_modules 中指向 bundle 外部的 .bin 符号链接（codesign 会报错）
  const removedLinks = cleanBinLinks(path.join(distModules, ".bin"), appDir);
  for (const entry of fs.readdirSync(distModules, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const nested = path.join(distModules, entry.name, "node_modules", ".bin");
    if (fs.existsSync(nested)) removedLinks += cleanBinLinks(nested, appDir);
  }

  if (removedLinks > 0) {
    console.log(`[fix-modules] 清理了 ${removedLinks} 个指向 bundle 外部的 .bin 符号链接`);
  }
};

exports.SERVER_NODE_MODULE_REQUIRED_FILES = SERVER_NODE_MODULE_REQUIRED_FILES;
exports.assertBundledServerNodeModulesReady = assertBundledServerNodeModulesReady;
exports.copyBundledServerNodeModules = copyBundledServerNodeModules;
exports.pruneDevDependencies = pruneDevDependencies;

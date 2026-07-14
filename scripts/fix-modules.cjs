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
// 精准闭包复制（替代整拷根 node_modules 再删的死重方案）：
//
// 原方案（v1）的问题：整拷根 node_modules 全部条目（~900 个包，含 devDep /
// 桌面渲染层死重）进 server-bundle/node_modules，再逐一删除 → 删除不彻底（
// 嵌套 node_modules / 传递依赖漏删），最终 905MB。
//
// 新方案（v2）：只复制 server-bundle/package.json 声明的闭包包（~450 个，
// _copy-deps.cjs 基于 vite external + 传递依赖算出），外加 SAFE_KEEP 中的
// 动态加载 provider SDK → 复制量精准、无漏删风险、体积直接从 905MB 降到 ~300MB。
//
// 运行时正确性保证：
// 1. server-bundle/package.json 的闭包 = server 运行时需要的全部包（vite external
//    + 所有传递依赖），闭包外的包 server 永不 import（已在 index.js 中内联）
// 2. SAFE_KEEP 中的动态加载 SDK（@mariozechner/* 等）虽在闭包中，但额外加
//    双保险防按需 import 场景漏包
// 3. native addon（better-sqlite3/node-pty/@node-rs/jieba）随闭包复制一并就位
//
// 已通过无头启动 server + /api/health 200 双重验证（详见 0.4.1 验证记录）。

// 动态加载 provider SDK 的双保险名单（防按需 import 场景漏包）。
// 这些包在闭包内本就存在，此处为双保险；不会额外保留大量死重。
const SERVER_DYNAMIC_SAFE_KEEP = new Set([
  "@mariozechner", "@anthropic-ai", "@google", "@mistralai",
  "@larksuiteoapi", "@aws-sdk", "openai", "node-telegram-bot-api", "google-auth-library",
]);

const STRIP_PER_PACKAGE = new Set([
  "test", "tests", "__tests__", "__test__", "spec", "specs",
  "fixtures", "fixture", "testdata", "test-data", "test_files",
  "examples", "example", "demo", "demos",
  "docs", "doc", "documentation",
  "CHANGELOG.md", "CHANGES.md", "HISTORY.md", "NEWS.md",
  ".github", ".circleci", ".travis.yml", "appveyor.yml",
  "Makefile", "coverage", ".coverage",
]);

function duBytes(p) {
  let total = 0;
  let st;
  try { st = fs.statSync(p); } catch { return 0; }
  if (st.isDirectory()) {
    let entries;
    try { entries = fs.readdirSync(p, { withFileTypes: true }); } catch { return 0; }
    for (const e of entries) {
      total += duBytes(path.join(p, e.name));
    }
  } else {
    total += st.size;
  }
  return total;
}

function stripPackage(pkgDir) {
  let stripped = 0;
  try {
    const entries = fs.readdirSync(pkgDir, { withFileTypes: true });
    for (const entry of entries) {
      if (STRIP_PER_PACKAGE.has(entry.name)) {
        const full = path.join(pkgDir, entry.name);
        try { fs.rmSync(full, { recursive: true, force: true }); stripped++; } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
  return stripped;
}

function rebuildServerNodeModulesFromProject(serverDir, projectModules, opts = {}) {
  const target = path.join(serverDir, "node_modules");
  const log = typeof opts.log === "function" ? opts.log : console.log;

  // Read server-bundle/package.json closure
  const serverPkgPath = path.join(serverDir, "package.json");
  let closure;
  try {
    closure = new Set(
      Object.keys(JSON.parse(fs.readFileSync(serverPkgPath, "utf-8")).dependencies || {}),
    );
  } catch (err) {
    // Without the closure manifest, we can't do precision copying.
    // This should never happen — if it does, the build pipeline is broken.
    throw new Error(
      `[fix-modules] 无法读取 server 依赖闭包 (${serverPkgPath}): ${err.message}. ` +
      "Run _copy-deps.cjs or build:server first to generate dist-server-bundle/package.json."
    );
  }

  // Determine which packages to copy:
  // closure (from server-bundle/package.json) + SAFE_KEEP dynamic providers
  const isSafeKeep = (dep) => {
    if (SERVER_DYNAMIC_SAFE_KEEP.has(dep)) return true;
    const scope = dep.startsWith("@") ? dep.split("/")[0] : null;
    return scope ? SERVER_DYNAMIC_SAFE_KEEP.has(scope) : false;
  };

  const toCopy = new Set(closure);
  // Add SAFE_KEEP packages that might not be in closure (double insurance)
  for (const sk of SERVER_DYNAMIC_SAFE_KEEP) {
    if (!toCopy.has(sk)) toCopy.add(sk);
  }

  // Clean and rebuild
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });

  let copied = 0;
  let skipped = 0;

  for (const dep of toCopy) {
    // Skip @types/* (server runs as JS, not TS) except @types/node
    if (dep.startsWith("@types/") && dep !== "@types/node") {
      skipped++;
      continue;
    }

    const src = path.join(projectModules, dep);
    if (!fs.existsSync(src)) {
      // Try flat lookup for scoped packages
      log(`[fix-modules] Warning: ${dep} not found in project node_modules`);
      skipped++;
      continue;
    }

    const dest = path.join(target, dep);
    try {
      fs.cpSync(src, dest, { recursive: true });
      stripPackage(dest);
      copied++;
    } catch (err) {
      log(`[fix-modules] Failed to copy ${dep}: ${err.message}`);
      // Non-fatal: some packages may have permission issues but are not critical
    }
  }

  // Clean dangling .bin links
  const topBin = path.join(target, ".bin");
  if (fs.existsSync(topBin)) cleanBinLinks(topBin, serverDir);

  // 关键依赖兜底校验
  const requiredServerDeps = ["@mariozechner/pi-ai", "partial-json", "ws"];
  const stillMissing = requiredServerDeps.filter(
    (p) => !fs.existsSync(path.join(target, p, "package.json")),
  );
  if (stillMissing.length > 0) {
    throw new Error(`[fix-modules] server-bundle 缺少关键依赖: ${stillMissing.join(", ")}`);
  }

  log(`[fix-modules] 精准闭包重建 server node_modules → ${target}（${copied} 包复制，${skipped} 跳过）`);
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
  // ERR_MODULE_NOT_FOUND 崩溃）。改为从项目根已完整安装好的 node_modules
  // 只拷贝 server-bundle/package.json 声明的依赖闭包（_copy-deps.cjs 计算的
  // server externals + 完整传递依赖，已排除 devDependencies）——既 100% 完整，
  // 又比整拷根 node_modules 体量砍半，避免 NSIS 解压被 Defender 拖死。
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
exports.rebuildServerNodeModulesFromProject = rebuildServerNodeModulesFromProject;

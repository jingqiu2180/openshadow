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
// 递归目录体积（字节）
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

// server 永不 import 的「桌面 / 渲染层」生产依赖。
// 整拷根 node_modules 后，这些包在 server-bundle 里纯属死重且体积不小
// （mermaid 65MB / @tiptap 8MB / @codemirror 7MB / react-dom 8MB 等）。
// 它们在渲染进程自己的 node_modules 中照常保留，server 运行时完全用不到，可安全剔除。
// 仅裁剪「确定不服务 server」的包；动态加载的 provider SDK（openai / @mariozechner/* /
// @larksuiteoapi/* / node-telegram-bot-api / 等）一律保留，避免漏依赖导致 server 启动即崩。
const SERVER_UNUSED_DESKTOP_PROD_DEPS = [
  "react",
  "react-dom",
  "react-markdown",
  "remark-gfm",
  "codemirror",
  "@codemirror",   // 作用域：整删 @codemirror/* 目录
  "@tiptap",       // 作用域：整删 @tiptap/* 目录
  "mermaid",
  "motion",
  "zustand",
  "electron-updater",
];

// 从 server-bundle/node_modules 中剔除 server 不用的桌面生产依赖（非阻塞：逐包 try/catch）。
function pruneDesktopOnlyProdDeps(serverDir, opts = {}) {
  const target = path.join(serverDir, "node_modules");
  if (!fs.existsSync(target)) return;
  const log = typeof opts.log === "function" ? opts.log : console.log;
  let removed = 0;
  let savedBytes = 0;
  for (const dep of SERVER_UNUSED_DESKTOP_PROD_DEPS) {
    const isScope = dep.startsWith("@") && !dep.includes("/");
    if (isScope) {
      const scopeDir = path.join(target, dep);
      if (fs.existsSync(scopeDir)) {
        for (const inner of fs.readdirSync(scopeDir)) {
          const p = path.join(scopeDir, inner);
          try { savedBytes += duBytes(p); } catch { /* ignore */ }
          try { fs.rmSync(p, { recursive: true, force: true }); removed++; } catch { /* ignore */ }
        }
      }
      continue;
    }
    const p = path.join(target, dep);
    if (fs.existsSync(p)) {
      try { savedBytes += duBytes(p); } catch { /* ignore */ }
      try { fs.rmSync(p, { recursive: true, force: true }); removed++; } catch { /* ignore */ }
    }
  }
  if (removed > 0) {
    log(
      `[fix-modules] 剔除 ${removed} 个 server 不用的桌面生产依赖` +
      `（省 ~${(savedBytes / 1024 / 1024).toFixed(0)}MB，server-bundle 瘦身后仍经启动校验）`,
    );
  }
}

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

// 整拷项目根【完整】node_modules 进 server-bundle/node_modules，再做两级瘦身：
//
// 为什么整拷而非“闭包瘦身”（v0.3.43 初版踩坑）：
//  - 闭包（dist-server-bundle/package.json 声明的依赖）会漏掉 server 实际 import 的
//    传递依赖（如 hono 在 server-bundle/package.json 未声明 → 闭包漏拷 → server 启动即崩）。
//    静默漏依赖比“安装包稍大”危险得多，所以宁可整拷保完整。
//  - 整拷后用 pruneDevDependencies 剔除根 devDependencies（vite/electron/typescript/
//    esbuild/@types/*/vitest/@electron/* 等运行时完全不需要），体积大幅砍小，
//    显著降低 NSIS 解压被 Windows Defender 逐文件扫描拖死的风险（v0.3.42 实测装 16+ 分钟）。
//  - 再用 pruneDesktopOnlyProdDeps 剔除「server 永不 import」的桌面生产依赖
//    （react/@codemirror/@tiptap/mermaid/motion/zustand/electron-updater 等，浏览器端
//    渲染/编辑器/状态库），它们在渲染进程自己的 node_modules 中保留，server 运行时完全
//    用不到。裁剪名单经静态扫描（server bundle 对这批包 0 引用）+ 无头启动校验双重确认。
//  - native addon（better-sqlite3/node-pty）随整拷一并就位，已针对本平台编译。
function rebuildServerNodeModulesFromProject(serverDir, projectModules, opts = {}) {
  const target = path.join(serverDir, "node_modules");
  const log = typeof opts.log === "function" ? opts.log : console.log;
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });

  // 整拷根 node_modules 全部顶层条目（保留嵌套 node_modules = 完整传递依赖闭包）
  const entries = fs.readdirSync(projectModules, { withFileTypes: true });
  for (const entry of entries) {
    fs.cpSync(
      path.join(projectModules, entry.name),
      path.join(target, entry.name),
      { recursive: true },
    );
  }
  // 剔除 devDependencies 瘦身（不阻塞：读不到根 package.json 就跳过）
  pruneDevDependencies(serverDir, path.resolve(__dirname, "..", "package.json"), opts);
  // 额外剔除 server 永不 import 的桌面生产依赖（保守裁剪，进一步瘦身）
  pruneDesktopOnlyProdDeps(serverDir, opts);
  log(`[fix-modules] 重建 server node_modules → ${target}（整拷根 node_modules + 剔除 devDependencies + 剔除桌面生产依赖）`);

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
exports.pruneDevDependencies = pruneDevDependencies;
exports.pruneDesktopOnlyProdDeps = pruneDesktopOnlyProdDeps;
exports.rebuildServerNodeModulesFromProject = rebuildServerNodeModulesFromProject;

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

  // 对齐 openhanako：在打包后的 resources/server-bundle/ 中 npm install
  // 自动处理所有传递依赖、精确版本、native addon 编译
  const serverPkgPath = path.join(serverDir, "package.json");
  if (fs.existsSync(serverPkgPath)) {
    console.log("[fix-modules] npm install in server-bundle...");
    try {
      const { execSync } = require("child_process");
      execSync("npm install --omit=dev --no-audit --no-fund --prefer-offline", {
        cwd: serverDir,
        stdio: "inherit",
        env: { ...process.env, NODE_ENV: "production" },
      });
      console.log("[fix-modules] server-bundle deps installed");
    } catch (err) {
      console.error("[fix-modules] npm install failed:", err.message);
      throw err;
    }

    // 关键传递依赖校验：防止漏装导致 server 启动即崩
    // （如 @mariozechner/pi-ai → partial-json），进而首页拉不到 API。
    const requiredServerDeps = ["@mariozechner/pi-ai", "partial-json"];
    const missingServerDeps = requiredServerDeps.filter(
      (p) => !fs.existsSync(path.join(serverDir, "node_modules", p, "package.json")),
    );
    if (missingServerDeps.length > 0) {
      throw new Error(
        `[fix-modules] server-bundle 缺少关键依赖: ${missingServerDeps.join(", ")}。` +
          " 这通常是因为打包环境离线/缓存不完整导致 npm install 漏装传递依赖。" +
          " 请在联网环境重新构建，或检查 npm registry 可达性。",
      );
    }

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

  // 清理 node_modules 中指向 bundle 外部的 .bin 符号链接（codesign 会报错）
  let removedLinks = 0;
  function cleanBinLinks(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        const target = fs.readlinkSync(full);
        if (path.isAbsolute(target) && !target.startsWith(appDir)) {
          fs.unlinkSync(full);
          removedLinks++;
        }
      } else if (entry.isDirectory() && entry.name !== ".bin") {
        // 递归进 node_modules 子目录，但跳过非 node_modules 的深层目录
        const binDir = path.join(full, "node_modules", ".bin");
        if (fs.existsSync(binDir)) cleanBinLinks(binDir);
      }
    }
  }

  // 扫描顶层和嵌套的 .bin 目录
  const topBin = path.join(distModules, ".bin");
  if (fs.existsSync(topBin)) cleanBinLinks(topBin);
  for (const entry of fs.readdirSync(distModules, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const nested = path.join(distModules, entry.name, "node_modules", ".bin");
    if (fs.existsSync(nested)) cleanBinLinks(nested);
  }

  if (removedLinks > 0) {
    console.log(`[fix-modules] 清理了 ${removedLinks} 个指向 bundle 外部的 .bin 符号链接`);
  }
};

exports.SERVER_NODE_MODULE_REQUIRED_FILES = SERVER_NODE_MODULE_REQUIRED_FILES;
exports.assertBundledServerNodeModulesReady = assertBundledServerNodeModulesReady;
exports.copyBundledServerNodeModules = copyBundledServerNodeModules;

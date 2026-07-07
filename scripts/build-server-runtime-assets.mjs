import fs from "fs";
import path from "path";

export const SERVER_RUNTIME_ASSET_FILES = [
  "Hanako.png",
  "Butter.png",
  "Ming.png",
  "Kong.png",
];

export const SERVER_RUNTIME_ASSET_DIRS = [
  "character-cards",
  "cover-gallery",
];

export const SERVER_RUNTIME_RENDERER_REQUIRED_FILES = [
  "mobile.html",
  "manifest.webmanifest",
  "sw.js",
  "icon.png",
];

export const SERVER_RUNTIME_RENDERER_DIRS = [
  "icons",
  "lib",
  "themes",
  "locales",
];

function assertRequiredAssetExists(fsImpl, sourcePath, label) {
  if (!fsImpl.existsSync(sourcePath)) {
    throw new Error(`[build-server] required runtime asset missing: ${label}`);
  }
}

export function copyServerRuntimeAssets({ rootDir, outDir, fsImpl = fs }) {
  const copied = [];
  const sourceAssetsDir = path.join(rootDir, "desktop", "src", "assets");
  const targetAssetsDir = path.join(outDir, "desktop", "src", "assets");
  fsImpl.mkdirSync(targetAssetsDir, { recursive: true });

  for (const fileName of SERVER_RUNTIME_ASSET_FILES) {
    const sourcePath = path.join(sourceAssetsDir, fileName);
    assertRequiredAssetExists(fsImpl, sourcePath, path.join("desktop", "src", "assets", fileName));
    fsImpl.copyFileSync(sourcePath, path.join(targetAssetsDir, fileName));
    copied.push(path.join("desktop", "src", "assets", fileName));
  }

  for (const dirName of SERVER_RUNTIME_ASSET_DIRS) {
    const sourcePath = path.join(sourceAssetsDir, dirName);
    assertRequiredAssetExists(fsImpl, sourcePath, path.join("desktop", "src", "assets", dirName));
    fsImpl.cpSync(sourcePath, path.join(targetAssetsDir, dirName), { recursive: true });
    copied.push(path.join("desktop", "src", "assets", dirName) + path.sep);
  }

  const sourceRendererDir = path.join(rootDir, "desktop", "dist-renderer");
  const targetRendererDir = path.join(outDir, "desktop", "dist-renderer");
  assertRequiredAssetExists(fsImpl, sourceRendererDir, path.join("desktop", "dist-renderer"));
  // openshadow 是桌面 Electron 应用，未移植 openhanako 的 mobile PWA 完整源
  // （缺 mobile-main.tsx / manifest.webmanifest / sw.js），这些文件作为可选资源处理：
  // 存在则复制，缺失则跳过并告警，不阻断构建。桌面主程序用 index.html，不受影响。
  const presentRendererFiles = [];
  for (const fileName of SERVER_RUNTIME_RENDERER_REQUIRED_FILES) {
    const sourcePath = path.join(sourceRendererDir, fileName);
    if (!fsImpl.existsSync(sourcePath)) {
      console.warn(`[build-server] ⚠ desktop/dist-renderer/${fileName} not found, skipping (optional PWA asset)`);
      continue;
    }
    presentRendererFiles.push(fileName);
  }
  for (const dirName of ["assets", "lib", "themes", "locales"]) {
    assertRequiredAssetExists(fsImpl, path.join(sourceRendererDir, dirName), path.join("desktop", "dist-renderer", dirName));
  }
  fsImpl.rmSync(targetRendererDir, { recursive: true, force: true });
  fsImpl.mkdirSync(path.dirname(targetRendererDir), { recursive: true });
  for (const fileName of presentRendererFiles) {
    copyRuntimeFile(fsImpl, path.join(sourceRendererDir, fileName), path.join(targetRendererDir, fileName));
  }
  copyMobileRuntimeAssets({
    fsImpl,
    sourceAssetsDir: path.join(sourceRendererDir, "assets"),
    targetAssetsDir: path.join(targetRendererDir, "assets"),
    mobileHtmlPath: path.join(sourceRendererDir, "mobile.html"),
  });
  for (const dirName of SERVER_RUNTIME_RENDERER_DIRS) {
    const sourceDir = path.join(sourceRendererDir, dirName);
    if (!fsImpl.existsSync(sourceDir)) continue;
    copyRuntimeDir(fsImpl, sourceDir, path.join(targetRendererDir, dirName));
  }
  copied.push(path.join("desktop", "dist-renderer") + path.sep);

  return copied;
}

function copyMobileRuntimeAssets({ fsImpl, sourceAssetsDir, targetAssetsDir, mobileHtmlPath }) {
  // openshadow 未移植 mobile PWA 源（mobile.html 缺失），跳过移动端资源收集，避免 readFileSync 崩溃
  if (!fsImpl.existsSync(mobileHtmlPath)) {
    console.warn(`[build-server] ⚠ ${path.basename(mobileHtmlPath)} not found, skipping mobile asset collection`);
    return;
  }
  const assetNames = new Set();
  const queued = [];

  function addAsset(name) {
    const normalized = normalizeAssetName(name);
    if (!normalized || assetNames.has(normalized)) return;
    if (!fsImpl.existsSync(path.join(sourceAssetsDir, normalized))) return;
    assetNames.add(normalized);
    queued.push(normalized);
  }

  // SERVER_RUNTIME_ASSET_DIRS 里的目录（cover-gallery、character-cards 等）已由
  // copyServerRuntimeAssets 复制到 desktop/src/assets/，server API 从那里读取。
  // dist-renderer/assets/ 下同名子目录是 copyLegacyFiles 产生的未哈希原始副本，
  // mobile 前端用的是 Vite 哈希后的顶层文件，不需要这些原始副本。跳过以避免双重复制。
  const serverAssetDirSet = new Set(SERVER_RUNTIME_ASSET_DIRS);
  for (const name of listFilesRecursive(fsImpl, sourceAssetsDir)) {
    if (shouldExcludeRuntimeFile(name)) continue;
    const topDir = name.split(/[\\/]/)[0];
    if (serverAssetDirSet.has(topDir)) continue;
    if (!/\.(?:js|css)$/i.test(name)) addAsset(name);
  }

  collectAssetReferences(fsImpl.readFileSync(mobileHtmlPath, "utf-8"), addAsset);

  while (queued.length) {
    const name = queued.shift();
    if (!/\.(?:js|css)$/i.test(name)) continue;
    const sourcePath = path.join(sourceAssetsDir, name);
    if (!fsImpl.existsSync(sourcePath)) continue;
    collectAssetReferences(fsImpl.readFileSync(sourcePath, "utf-8"), addAsset);
  }

  for (const name of assetNames) {
    copyRuntimeFile(fsImpl, path.join(sourceAssetsDir, name), path.join(targetAssetsDir, name));
  }
}

function collectAssetReferences(content, addAsset) {
  const assetUrlPattern = /(?:href|src)=["'](?:\.\/)?assets\/([^"'?#]+)/g;
  const relativePattern = /["']\.\/([^"'?#]+)["']/g;
  const cssUrlPattern = /url\(\s*["']?(?!data:|https?:|\/)([^"')?#]+)["']?\s*\)/g;
  for (const pattern of [assetUrlPattern, relativePattern, cssUrlPattern]) {
    for (const match of content.matchAll(pattern)) addAsset(match[1]);
  }
}

function normalizeAssetName(value) {
  const normalized = String(value || "").replace(/\\/g, "/").replace(/^\.\//, "").replace(/^assets\//, "");
  if (!normalized || normalized.startsWith("/") || normalized.includes("\0")) return null;
  const parts = normalized.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) return null;
  if (shouldExcludeRuntimeFile(normalized)) return null;
  return parts.join(path.sep);
}

function shouldExcludeRuntimeFile(relativePath) {
  return relativePath.split(/[\\/]/).some((part) => part === ".DS_Store" || part.endsWith(".map"));
}

function copyRuntimeFile(fsImpl, sourcePath, targetPath) {
  fsImpl.mkdirSync(path.dirname(targetPath), { recursive: true });
  fsImpl.copyFileSync(sourcePath, targetPath);
}

function copyRuntimeDir(fsImpl, sourceDir, targetDir) {
  fsImpl.cpSync(sourceDir, targetDir, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(sourceDir, source);
      return !relative || !shouldExcludeRuntimeFile(relative);
    },
  });
}

function listFilesRecursive(fsImpl, rootDir) {
  const names = [];
  function visit(dir, prefix = "") {
    for (const entry of fsImpl.readdirSync(dir, { withFileTypes: true })) {
      const relative = prefix ? path.join(prefix, entry.name) : entry.name;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath, relative);
      } else if (entry.isFile()) {
        names.push(relative);
      }
    }
  }
  visit(rootDir);
  return names;
}

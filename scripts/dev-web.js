#!/usr/bin/env node
/**
 * dev-web.js — openshadow 浏览器开发模式
 *
 * 流程：
 *   1. 启动 server（端口 0 让 server 自己选空闲端口）
 *   2. 等 server 写 server-info.json（包含 port + token）
 *   3. 启动 Vite，注入 HANA_DEV_WEB_* 环境变量，让 vite.config.ts 创建带 auth 头的 proxy
 *   4. 浏览器打开 http://127.0.0.1:5280
 *
 * 跟 openhanako 区别：
 *   - home 用 ~/.openshadow-dev
 *   - Vite 端口 5280（保持 openshadow 原有）
 *   - Vite config 路径 desktop/vite.config.ts
 *   - Server entry server/bootstrap.ts（保持 openshadow 架构）
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { applyDevEnvironment, defaultDevShadowHome } from "./dev-env.js";
import {
  buildDevWebClientConfig,
  buildDevWebPreviewUrl,
  normalizeServerInfoForDevWeb,
  resolveViteCommand,
} from "./dev-web-runtime.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const shadowHome = defaultDevShadowHome();
const serverInfoPath = path.join(shadowHome, "server-info.json");

let serverProcess = null;
let viteProcess = null;
let shuttingDown = false;

function log(message) {
  process.stdout.write(`[dev-web] ${message}\n`);
}

function removeStaleServerInfo() {
  try {
    fs.unlinkSync(serverInfoPath);
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
  }
}

function isChildAlive(child) {
  return !!child && child.exitCode === null && child.signalCode === null;
}

async function waitForServerInfo({ timeoutMs = 90_000, intervalMs = 200 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isChildAlive(serverProcess)) {
      throw new Error("Shadow server exited before writing server-info.json");
    }
    try {
      const raw = fs.readFileSync(serverInfoPath, "utf-8");
      return normalizeServerInfoForDevWeb(JSON.parse(raw));
    } catch {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  throw new Error("Timed out waiting for server-info.json");
}

function resolveTsxCommand(rootDir, {
  platform = process.platform,
} = {}) {
  const pathImpl = platform === "win32" ? path.win32 : path.posix;
  return pathImpl.join(
    rootDir,
    "node_modules",
    ".bin",
    platform === "win32" ? "tsx.cmd" : "tsx",
  );
}

function spawnServer() {
  fs.mkdirSync(shadowHome, { recursive: true });
  removeStaleServerInfo();

  const serverEnv = applyDevEnvironment({ ...process.env });
  serverEnv.SHADOW_ROOT = rootDir;
  serverEnv.SHADOW_HOME = shadowHome;
  serverEnv.SHADOW_PORT = process.env.SHADOW_PORT || "0";
  serverEnv.SHADOW_CREATE_STARTUP_SESSION = "0";
  delete serverEnv.ELECTRON_RUN_AS_NODE;

  const tsxBin = resolveTsxCommand(rootDir);
  serverProcess = spawn(tsxBin, [path.join(rootDir, "start.ts")], {
    cwd: rootDir,
    env: serverEnv,
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  serverProcess.on("exit", (code, signal) => {
    if (!shuttingDown && isChildAlive(viteProcess)) {
      log(`server exited (${signal || code}); stopping Vite`);
      viteProcess.kill(signal || "SIGTERM");
    }
  });
}

function spawnVite(clientConfig, serverInfo) {
  const viteBin = resolveViteCommand(rootDir);
  const viteEnv = applyDevEnvironment({ ...process.env });
  viteEnv.HANA_DEV_WEB = "1";
  viteEnv.HANA_DEV_WEB_CLIENT_PORT = clientConfig.serverPort;
  viteEnv.HANA_DEV_WEB_API_BASE_URL = clientConfig.apiBaseUrl;
  viteEnv.HANA_DEV_WEB_SERVER_URL = `http://127.0.0.1:${serverInfo.port}`;
  viteEnv.HANA_DEV_WEB_SERVER_TOKEN = serverInfo.token;
  delete viteEnv.ELECTRON_RUN_AS_NODE;

  viteProcess = spawn(viteBin, [
    "--config",
    path.join(rootDir, "vite.config.ts"),
    "--host",
    "127.0.0.1",
  ], {
    cwd: rootDir,
    env: viteEnv,
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  viteProcess.on("exit", (code, signal) => {
    if (!shuttingDown && isChildAlive(serverProcess)) {
      log(`Vite exited (${signal || code}); stopping server`);
      serverProcess.kill(signal || "SIGTERM");
    }
  });
}

function shutdown(signal = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;
  if (isChildAlive(viteProcess)) viteProcess.kill(signal);
  if (isChildAlive(serverProcess)) serverProcess.kill(signal);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
if (process.platform === "win32") {
  process.on("SIGBREAK", () => shutdown("SIGBREAK"));
}

try {
  spawnServer();
  const serverInfo = await waitForServerInfo();
  const clientConfig = buildDevWebClientConfig(serverInfo);
  spawnVite(clientConfig, serverInfo);
  log(`open ${buildDevWebPreviewUrl()}`);
} catch (err) {
  shutdown();
  console.error(`[dev-web] ${err?.stack || err?.message || String(err)}`);
  process.exitCode = 1;
}

/**
 * cli/entry.ts — OpenShadow standalone CLI 入口（server-first）
 *
 * 1. import "../server/index.js" 会触发 server/index.ts 顶层的 start() IIFE，
 *    从而启动 HTTP + WebSocket server 并写出 server-info.json。
 * 2. 轮询 server-info.json，拿到 port / token 后附加终端交互界面
 *    （server/cli.ts 的 startCLI）。
 *
 * 该文件由 scripts/build-server.mjs 用 esbuild 打成 bundle/cli.js，
 * 供 openshadow-server 包装脚本（Windows / Unix）调用。
 * Electron 主进程走 bundle/index.js（Vite 产物），不走这里。
 */
import "../server/index.js";
import { startCLI } from "../server/cli.js";
import * as fs from "fs";
import * as path from "path";

const shadowHome =
  process.env.SHADOW_HOME ||
  process.env.OPENSHADOW_HOME ||
  path.join(process.cwd(), ".openshadow");
const infoPath = path.join(shadowHome, "server-info.json");

function tryAttach(attempt = 0): void {
  if (attempt > 50) {
    console.error("[cli] server did not start in time, exiting");
    process.exit(1);
  }
  let info: { port: number; token: string };
  try {
    if (!fs.existsSync(infoPath)) {
      setTimeout(() => tryAttach(attempt + 1), 100);
      return;
    }
    info = JSON.parse(fs.readFileSync(infoPath, "utf-8"));
  } catch {
    setTimeout(() => tryAttach(attempt + 1), 100);
    return;
  }
  startCLI({
    port: info.port,
    token: info.token,
    agentName: process.env.AGENT_NAME,
    userName: process.env.USER || process.env.USERNAME,
  });
}

tryAttach();

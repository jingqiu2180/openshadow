import path from "node:path";

/**
 * 解析 server-info.json 内容为 {port, token}，缺一即抛错。
 * 与 openhanako 同形，方便两边 dev-web 脚本结构一致。
 */
export function normalizeServerInfoForDevWeb(info) {
  const port = Number(info?.port);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("server-info port is required for dev-web");
  }

  const token = typeof info?.token === "string" ? info.token.trim() : "";
  if (!token) {
    throw new Error("server-info token is required for dev-web");
  }

  return {
    port,
    token,
  };
}

export function buildDevWebClientConfig(serverInfo, {
  clientHost = "127.0.0.1",
  clientPort = 5280,
  protocol = "http",
} = {}) {
  normalizeServerInfoForDevWeb(serverInfo);
  const port = Number(clientPort);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("client port is required for dev-web");
  }
  return {
    serverPort: String(port),
    apiBaseUrl: `${protocol}://${clientHost}:${port}`,
  };
}

export function buildDevWebPreviewUrl({
  host = "127.0.0.1",
  port = 5280,
  protocol = "http",
} = {}) {
  return `${protocol}://${host}:${port}/index.html`;
}

export function resolveViteCommand(rootDir, {
  platform = process.platform,
} = {}) {
  const pathImpl = platform === "win32" ? path.win32 : path.posix;
  return pathImpl.join(
    rootDir,
    "node_modules",
    ".bin",
    platform === "win32" ? "vite.cmd" : "vite",
  );
}

/**
 * Settings window API utilities
 * 从 settings store 读 port/token，独立于主窗口
 */
import { useSettingsStore } from './store';
import {
  appendConnectionAuth,
  buildConnectionUrl,
  requireServerConnection,
} from '../services/server-connection';

const DEFAULT_TIMEOUT = 30_000;

export function hanaUrl(path: string): string {
  const connection = requireServerConnection(
    useSettingsStore.getState(),
    `settings hanaUrl ${path}: server connection not ready`,
  );
  return buildConnectionUrl(connection, path, { includeTokenQuery: true });
}

export async function hanaFetch(
  path: string,
  opts: RequestInit & { timeout?: number } = {},
): Promise<Response> {
  const connection = requireServerConnection(
    useSettingsStore.getState(),
    `settings hanaFetch ${path}: server connection not ready`,
  );
  const headers = appendConnectionAuth(connection, opts.headers);

  const { timeout = DEFAULT_TIMEOUT, signal: callerSignal, ...fetchOpts } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  // If caller provided a signal, forward its abort to our controller
  if (callerSignal) {
    if (callerSignal.aborted) { controller.abort(); }
    else { callerSignal.addEventListener('abort', () => controller.abort(), { once: true }); }
  }

  try {
    const res = await fetch(buildConnectionUrl(connection, path), {
      ...fetchOpts,
      headers,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`hanaFetch ${path}: ${res.status} ${res.statusText}`);
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// 修正：复用 agent-helpers 的 Vite 资源 import（dev/build/asar 三模式路径都正确），
// 避免原先返回相对路径 `assets/*.png` 在渲染进程里解析成 404 导致设置/助手头像碎图。
export { yuanFallbackAvatar } from '../utils/agent-helpers';

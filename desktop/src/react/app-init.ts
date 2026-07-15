/**
 * app-init.ts — 应用初始化逻辑（纯函数，非 React 组件）
 *
 * 从 App.tsx 提取。包含：
 * - __openshadowLog 日志上报
 * - 全局错误 / unhandled rejection 监听
 * - initApp() 主初始化流程
 */

import { useStore } from './stores';
import { openshadowFetch } from './hooks/use-openshadow-fetch';
import { applyAgentIdentity, loadAgents, loadAvatars } from './stores/agent-actions';
import { loadSessions, switchSession } from './stores/session-actions';
import { initSessionProjectCatalog } from './stores/session-project-actions';
import { connectWebSocket, getWebSocket } from './services/websocket';
import { setStatus, loadModels } from './utils/ui-helpers';
import { initJian } from './stores/desk-actions';
import { initViewerEvents } from './stores/preview-actions';
import { updateLayout } from './components/SidebarLayout';
import { initErrorBusBridge } from './errors/error-bus-bridge';
import { refreshPluginUI } from './stores/plugin-ui-actions';
import { openSettingsModal } from './stores/settings-modal-actions';
import { initQuotedSelectionLifecycle } from './stores/selection-actions';
import { configureAppEventActions, handleAppEvent, readConfigCwdHistory, readConfigHomeFolder, readConfigMemoryMasterEnabled } from './services/app-event-actions';
import { configureWsMessageHandler } from './services/ws-message-handler';
import { applyEditorTypography } from './editor/typography';
import {
  LOCAL_CONNECTION_ID,
  createLocalServerConnection,
  hasServerConnection,
  mergeServerIdentity,
  readPersistedServerConnectionState,
  refreshLocalServerConnectionState,
  upsertServerConnection,
  type ServerConnection,
} from './services/server-connection';
import { persistAppearancePreferences } from './services/appearance-sync';
import { errorBus as _errorBus } from '../../../shared/error-bus.ts';
import { AppError as _AppError } from '../../../shared/errors.ts';

declare const i18n: {
  locale: string;
  defaultName: string;
  load(locale: string): Promise<void>;
};
declare function t(key: string, vars?: Record<string, string | number>): string;

/**
 * 启动即无条件加载 i18n（不依赖 server）。
 * locale 文件已随包打包进 dist-renderer/locales，用 localStorage / navigator.language / 默认 zh 决定初始语言。
 * 关键：i18n 绝不能耦合在 server 就绪之后——否则 server 未就绪时整段 init 被 catch 吞掉，
 * 导致所有文案回退成原始 key（如 status.serverNotReady），且只能靠手动打开设置才恢复。
 */
async function loadInitialI18n(): Promise<void> {
  let locale = 'zh';
  try {
    const persisted = typeof localStorage !== 'undefined' ? localStorage.getItem('openshadow.locale') : null;
    if (persisted) locale = persisted;
    else if (typeof navigator !== 'undefined' && navigator.language) locale = navigator.language;
  } catch { /* ignore */ }
  try {
    await i18n.load(locale);
  } catch (err) {
    console.warn('[init] initial i18n load failed, falling back to zh:', err);
    try { await i18n.load('zh'); } catch { /* ignore */ }
  }
  useStore.setState({ locale: i18n.locale });
}

/* eslint-disable @typescript-eslint/no-explicit-any -- 全局 bootstrap：platform/IPC callback 签名含 any */

function markRendererLaunch(event: string, details?: unknown) {
  if (details === undefined) {
    console.info(`[openshadow-launch] ${event}`);
  } else {
    console.info(`[openshadow-launch] ${event}`, details);
  }
}

// ── __openshadowLog：前端日志上报 ──
window.__openshadowLog = function (level: string, module: string, message: string) {
  if (!hasServerConnection(useStore.getState())) return;
  openshadowFetch('/api/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level, module, message }),
  }).catch(err => console.warn('[openshadowLog] log upload failed:', err));
};

// ── 全局错误捕获 ──
window.addEventListener('error', (e) => {
  _errorBus.report(_AppError.wrap(e.error || e.message), {
    context: { filename: e.filename, line: e.lineno },
  });
});
window.addEventListener('unhandledrejection', (e) => {
  _errorBus.report(_AppError.wrap(e.reason));
});

// ── 主初始化流程 ──

export async function initApp(): Promise<void> {
  const platform = window.platform;
  initQuotedSelectionLifecycle();

  // 0. 无条件预加载 i18n（先于任何 server 依赖），确保启动即显示翻译文案而非原始 key
  await loadInitialI18n();

  const requestContextUsage = (sessionPath: string) => {
    const ws = getWebSocket();
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'context_usage', sessionPath }));
    }
  };
  configureAppEventActions({ requestContextUsage });
  configureWsMessageHandler({ requestContextUsage });

  platform.onServerRestarted?.((data: { port: number; token?: string | null }) => {
    const storeState = useStore.getState();
    const serverPort = String(data.port);
    const serverToken = data.token ?? storeState.serverToken ?? null;
    const activeBeforeRestart = storeState.activeServerConnection;
    const nextConnectionState = refreshLocalServerConnectionState({
      serverConnections: storeState.serverConnections,
      activeServerConnectionId: storeState.activeServerConnectionId,
      activeServerConnection: storeState.activeServerConnection,
      serverPort,
      serverToken,
    });
    useStore.setState({
      serverPort,
      serverToken,
      ...nextConnectionState,
    });
    if (!activeBeforeRestart || activeBeforeRestart.connectionId === LOCAL_CONNECTION_ID) {
      connectWebSocket();
    }
  });

  // 1. 获取 server 连接信息并存入 Zustand
  // 轮询直到 server 就绪（避免一次性 server:ready 事件在监听器注册前就发出、导致永久错过）
  let serverPort = await platform.getServerPort();
  let serverToken = await platform.getServerToken();

  if (!serverPort) {
    console.log('[init] Server not ready yet, polling for server port...');
    const deadline = Date.now() + 30000;
    while (!serverPort && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 300));
      serverPort = await platform.getServerPort();
      serverToken = await platform.getServerToken();
    }
    // 兜底：轮询间隙若 server:ready 事件恰好发出，再等一次事件
    if (!serverPort) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 2000);
        platform.onServerReady?.((data: { port: number; token?: string }) => {
          serverPort = String(data.port);
          serverToken = data.token ?? null;
          clearTimeout(timeout);
          resolve();
        });
      });
    }
  }
  
  const localServerConnection = createLocalServerConnection({ serverPort, serverToken });
  const persistedConnections = readPersistedServerConnectionState();
  const initialRegistry = localServerConnection
    ? upsertServerConnection(persistedConnections.serverConnections, localServerConnection)
    : persistedConnections.serverConnections;
  const requestedActiveConnection = persistedConnections.activeServerConnectionId
    ? initialRegistry[persistedConnections.activeServerConnectionId]
    : null;
  const activeServerConnection = requestedActiveConnection || localServerConnection;
  useStore.setState({
    serverPort,
    serverToken,
    serverConnections: initialRegistry,
    activeServerConnectionId: activeServerConnection?.connectionId ?? null,
    activeServerConnection,
  });

  // 1b. 把真实端口暴露给 legacy store.ts（它之前硬编码 3000，导致端口≠3000 时全部失败）
  if (serverPort) {
    try { (window as unknown as { __shadowServerPort?: number }).__shadowServerPort = Number(serverPort); } catch {}
  }

  // 1c. 等待 server 真正可服务（health 200）再加载 config/i18n/models，避免启动竞态
  if (serverPort) {
    const healthOk = await waitForServerHealth(30000);
    if (!healthOk) {
      console.warn('[init] server health check timed out, proceeding with best-effort (i18n/models may need a manual refresh)');
    }
  }

  if (!activeServerConnection) {
    setStatus('status.serverNotReady', false);
    markRendererLaunch('app-ready', JSON.stringify({ reason: 'no-active-server-connection' }));
    platform.appReady();
    return;
  }

  try {
    await refreshDeviceWebSession(activeServerConnection);
    const mergedConnection = await loadIdentityForActiveConnection(activeServerConnection);
    useStore.setState({
      serverConnections: upsertServerConnection(useStore.getState().serverConnections, mergedConnection),
      activeServerConnectionId: mergedConnection.connectionId,
      activeServerConnection: mergedConnection,
    });
  } catch (err) {
    if (activeServerConnection.connectionId !== LOCAL_CONNECTION_ID && localServerConnection) {
      console.warn('[init] remote server identity failed, returning to local server:', err);
      useStore.setState({
        activeServerConnectionId: localServerConnection.connectionId,
        activeServerConnection: localServerConnection,
      });
      try {
        await refreshDeviceWebSession(localServerConnection);
        const mergedConnection = await loadIdentityForActiveConnection(localServerConnection);
        useStore.setState({
          serverConnections: upsertServerConnection(useStore.getState().serverConnections, mergedConnection),
          activeServerConnectionId: mergedConnection.connectionId,
          activeServerConnection: mergedConnection,
        });
      } catch (localErr) {
        console.error('[init] server identity failed:', localErr);
        setStatus('status.serverNotReady', false);
        markRendererLaunch('app-ready', JSON.stringify({ reason: 'local-server-identity-failed' }));
        platform.appReady();
        return;
      }
    } else {
      console.error('[init] server identity failed:', err);
      setStatus('status.serverNotReady', false);
      markRendererLaunch('app-ready', JSON.stringify({ reason: 'server-identity-failed' }));
      platform.appReady();
      return;
    }
  }

  persistAppearancePreferences().catch((err) => {
    console.warn('[init] appearance preference sync skipped:', err);
  });

  // 2. 并行获取 health + config
  try {
    const [healthRes, configRes] = await Promise.all([
      openshadowFetch('/api/health'),
      openshadowFetch('/api/config'),
    ]);
    const healthData = await healthRes.json();
    const configData = await configRes.json();
    applyEditorTypography(configData.editor);

    // 3. 刷新 i18n（若 server 返回的 locale 与启动时初始语言不同）。
    //    注意：i18n 已在 initApp 开头无条件加载，此处仅做 locale 精修，失败也不影响已加载的文案。
    try {
      if (configData.locale && configData.locale !== i18n.locale) {
        await i18n.load(configData.locale);
        useStore.setState({ locale: i18n.locale });
      }
    } catch (i18nErr) {
      console.warn('[init] i18n locale refinement skipped:', i18nErr);
    }

    // 4. 应用 agent 身份
    await applyAgentIdentity({
      agentName: healthData.agent || 'Shadow',
      userName: healthData.user || t('common.user'),
      ui: { avatars: false, agents: false, welcome: true },
    });

    // 5. 设置 desk 相关状态
    const homeFolder = readConfigHomeFolder(configData);
    useStore.setState({
      homeFolder,
      selectedFolder: homeFolder,
      workspaceFolders: [],
      memoryMasterEnabled: readConfigMemoryMasterEnabled(configData),
    });
    useStore.setState({ cwdHistory: readConfigCwdHistory(configData) });

    // 6. 加载头像
    loadAvatars(healthData.avatars);
  } catch (err) {
    console.error('[init] health/config failed (i18n already loaded independently):', err);
  }

  // 8. 连接 WebSocket
  connectWebSocket();
  initErrorBusBridge();

  // 9. 加载模型
  await loadModels();

  // 10. 加载 agents + sessions
  useStore.setState({ pendingNewSession: true });
  await loadAgents();
  await loadSessions();

  // 10b. 加载项目目录（带重试）。放在 sessions 之后：此时 server 已确认可用，
  // 避免项目目录像过去那样只靠 SessionList 挂载时一次性拉取、失败即长期空白，
  // 导致自定义项目消失、其会话被错误并入 cwd 推导分组。
  await initSessionProjectCatalog();

  // 11. 初始化书桌
  initJian();

  // 12. 注册派生 viewer 窗口关闭事件（清 pinnedViewers store）
  initViewerEvents();

  // 13. 初始 layout 计算
  updateLayout();

  // 14. 任务计划 badge 初始值
  try {
    const res = await openshadowFetch('/api/desk/cron');
    const data = await res.json();
    const count = (data.jobs || []).length;
    useStore.setState({ automationCount: count });
  } catch { /* ignore */ }

  // 15. Bridge 状态指示点（启动时就查一次，不等用户打开面板）
  try {
    const res = await openshadowFetch('/api/bridge/status');
    const data = await res.json();
    const anyConnected = data.telegram?.status === 'connected' || data.feishu?.status === 'connected' || data.qq?.status === 'connected' || data.wechat?.status === 'connected' || data.whatsapp?.status === 'connected';
    useStore.setState({ bridgeDotConnected: anyConnected });
  } catch { /* ignore */ }

  // 16. 加载插件 UI（pages / widgets）
  refreshPluginUI();

  // 18. 设置快捷键
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault();
      openSettingsModal();
    }
  });

  // 19. 设置变更监听
  platform.onSettingsChanged((type: string, data: any) => {
    handleAppEvent(type, data, { source: 'desktop-ipc' });
  });

  // 20. 主进程请求打开设置：托盘 / 外部 IPC 统一落到主窗口 modal
  platform.onOpenSettingsModal?.((tab?: string) => {
    openSettingsModal(tab);
  });

  // 21. Quick Chat 请求打开后台会话：复用主窗口既有 session 切换路径
  platform.onQuickChatOpenSession?.((payload: { sessionPath?: string }) => {
    if (payload?.sessionPath) {
      void switchSession(payload.sessionPath);
      loadSessions();
    }
  });

  // 21. Skill Viewer overlay（主进程 / 设置窗口 → 渲染进程）
  window.shadow?.onShowSkillViewer?.((data: any) => {
    useStore.setState({ skillViewerData: data });
  });

  // 22. 通知 app ready
  markRendererLaunch('app-ready');
  platform.appReady();
}

async function loadIdentityForActiveConnection(connection: ServerConnection): Promise<ServerConnection> {
  const identityRes = await openshadowFetch('/api/server/identity');
  const identityData = await identityRes.json();
  return mergeServerIdentity(connection, identityData);
}

async function refreshDeviceWebSession(connection: ServerConnection): Promise<void> {
  if (connection.credentialKind !== 'device_credential' || !connection.token) return;
  await openshadowFetch('/api/web-auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ credential: connection.token }),
  });
}

// 等待 server 真正可服务（/api/health 返回 200）。轮询重试，避免启动竞态下 health 还没好就拉 config。
async function waitForServerHealth(timeoutMs = 30000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await openshadowFetch('/api/health');
      if (res.ok) return true;
    } catch {
      /* server 还没好，继续等 */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

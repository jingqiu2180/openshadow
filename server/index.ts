/**
 * OpenShadow Server — HTTP + WebSocket API
 *
 * 启动方式：
 *   node server/index.js   （独立运行）
 *
 * 路由对齐 openhanako：挂载 37 个业务路由。
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), '.env') });
console.log('[env] AGENT_API_KEY:', process.env.AGENT_API_KEY ? 'present' : 'missing', 'AGENT_BASE_URL:', process.env.AGENT_BASE_URL);
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import path from 'path'
import os from 'os'
import * as fsSync from 'fs'
import { createNodeWebSocket } from '@hono/node-ws'
import { fileURLToPath } from 'url'

import { HanaEngine } from '../core/engine.js'
import { ensureFirstRun } from '../core/first-run.js'
import {
  ensureHanaPiSdkDirs,
  configureProcessPiSdkEnv,
} from '../shared/hana-runtime-paths.js'
import { fromRoot } from '../shared/hana-root.js'
import { createAccessRoute } from './routes/access.js'
import { createAgentsRoute } from './routes/agents.js'
import { createAuthRoute } from './routes/auth.js'
import { createAvatarRoute } from './routes/avatar.js'
import { createBridgeRoute } from './routes/bridge.js'
import { createChannelsRoute } from './routes/channels.js'
import { createCharacterCardsRoute } from './routes/character-cards.js'
import { createChatRoute } from './routes/chat.js'
import { Hub } from '../hub/index.js'
import { createCheckpointsRoute } from './routes/checkpoints.js'
import { createCommandsRoute } from './routes/commands.js'
import { createConfigRoute } from './routes/config.js'
import { createConfirmRoute } from './routes/confirm.js'
import { createDeskRoute } from './routes/desk.js'
import { createDevicesRoute } from './routes/devices.js'
import { createDiaryRoute } from './routes/diary.js'
import { createDmRoute } from './routes/dm.js'
import { createExperimentsRoute } from './routes/experiments.js'
import { createFsRoute } from './routes/fs.js'
import { createHtmlPreviewRoute } from './routes/html-preview.js'
import { createMediaRoute } from './routes/media.js'
import { createMobileStaticRoute } from './routes/mobile-static.js'
import { createMobileWorkbenchRoute } from './routes/mobile-workbench.js'
import { createModelsRoute } from './routes/models.js'
import { createPluginProxyRoute, createPluginsRoute } from './routes/plugins.js'
import { createPreferencesRoute } from './routes/preferences.js'
import { createProvidersRoute } from './routes/providers.js'
import { createResourcesRoute } from './routes/resources.js'
import { createServerIdentityRoute } from './routes/server-identity.js'
import { createSessionProjectsRoute } from './routes/session-projects.js'
import { createSessionsRoute } from './routes/sessions.js'
import { createSettingsSnapshotRoute } from './routes/settings-snapshot.js'
import { createSkillsRoute } from './routes/skills.js'
import { createSpeechRecognitionRoute } from './routes/speech-recognition.js'
import { createStudioWorkspacesRoute } from './routes/studio-workspaces.js'
import { createUploadRoute } from './routes/upload.js'
import { createUsageRoute } from './routes/usage.js'
import { createWebAuthRoute } from './routes/web-auth.js'

const app = new Hono()

// 初始化 node-ws（提供真实的 upgradeWebSocket 实现）
// createNodeWebSocket 必须在所有路由挂载之前调用
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

// Middleware
app.use('*', cors())

// Health check
app.get('/', (c) => c.json({
  name: 'OpenShadow',
  version: '0.1.0',
  status: 'running',
}))

app.get('/health', (c) => c.json({ ok: true }))
app.get('/api/health', (c) => c.json({ ok: true }))

/**
 * 异步启动：创建引擎 → init() → 挂载路由 → 启动 HTTP 服务
 */
/**
 * 解析 Shadow Home（用户数据根目录）
 * 优先级：SHADOW_HOME > OPENSHADOW_HOME > ~/.openshadow
 * 对齐 openhanako 的 resolveHanakoHome(process.env.HANA_HOME)
 */
function resolveShadowHome(): string {
  const explicit = process.env.SHADOW_HOME || process.env.OPENSHADOW_HOME
  if (explicit) {
    fsSync.mkdirSync(explicit, { recursive: true })
    return explicit
  }
  const fallback = path.join(os.homedir(), '.openshadow')
  fsSync.mkdirSync(fallback, { recursive: true })
  return fallback
}

const shadowHome = resolveShadowHome()
process.env.SHADOW_HOME = shadowHome
process.env.OPENSHADOW_HOME = shadowHome

// 对齐 openhanako：Pi SDK 目录初始化 + 环境变量设置
ensureHanaPiSdkDirs(shadowHome)
configureProcessPiSdkEnv(shadowHome)

// 对齐 openhanako：productDir 指向 lib/ 数据目录（config.example.yaml 等模板）
const productDir = fromRoot('lib')

async function start() {
  // ensureFirstRun 播种默认配置（agents/config.yaml/provider-catalog.json 等）
  // 必须在 engine.init() 之前调用，否则 engine 读取不到 providers/models
  // ⚠️ 改为非致命：模板/路径缺失（如打包环境 lib/ 解析异常）只告警，不能让 server 起不来，
  // 否则 server-info.json 永远不写 → 主进程 done-signal 等待 15s 后跳过配置推送 →
  // 向导配置的模型不生效、首页也无法修改模型。
  console.log('[shadow] ensureFirstRun...')
  try {
    ensureFirstRun(shadowHome, productDir)
    console.log('[shadow] ensureFirstRun done')
  } catch (e) {
    console.error('[shadow] ensureFirstRun failed (non-fatal, continuing):', (e as any)?.message || e)
  }

  // 初始化 HanaEngine（对齐 openhanako：不传 agentId，引擎自动用 DEFAULT_AGENT_ID='hanako'）
  const engine: any = new HanaEngine({
    hanakoHome: shadowHome,
    productDir: productDir,
    appVersion: '0.1.0',
  } as any)

  // ═══ 关键：初始化引擎（加载 config、agents、plugins 等）═══
  console.log('[shadow] Initializing engine...')
  try {
    await engine.init((msg: any) => console.log('[engine]', msg))
    console.log('[shadow] Engine initialized (providers/models from disk via ensureFirstRun)')
  } catch (err) {
    console.error('[shadow] engine.init() failed:', (err as any).message)
  }

  // ═══ 创建 Hub（bridge / desktop session 等依赖）═══
  let hub: any
  try {
    hub = new Hub({ engine })
    console.log('[shadow] Hub created')
  } catch (err) {
    console.warn('[shadow] Hub creation failed, using dummy:', (err as any).message)
    hub = {
      subscribe(_h: any) { return () => {} },
      publish(_e: any) {},
      emit(_e: any) {},
      on(_e: any, _h: any) { return () => {} },
      off(_e: any, _h: any) {},
      async pauseForAgentSwitch() {},
      async resumeAfterAgentSwitch() {},
      abortAgentPhoneSessions() {},
      scheduler: { startAgentHeartbeat() {}, startAgentCron() {}, removeAgentCron() {}, stopHeartbeat() {} },
      dmRouter: null,
      eventBus: { emit() {} },
      async send() { throw new Error('hub send not available') },
    }
  }

  // ═══ 挂载 37 个业务路由 ═══

  app.route('/api', createAccessRoute({ engine }))
  app.route('/api', createAgentsRoute(engine))
  app.route('/api', createAuthRoute(engine))
  app.route('/api', createAvatarRoute(engine))
  app.route('/api', createBridgeRoute(engine, null))
  app.route('/api', createChannelsRoute(engine, hub))
  app.route('/api', createCharacterCardsRoute(engine))
  // createChatRoute 返回 { restRoute, wsRoute }
  const { restRoute: chatRestRoute, wsRoute: chatWsRoute } = createChatRoute(engine, hub, { upgradeWebSocket })
  app.route('/api', chatRestRoute)
  app.route('/api', chatWsRoute)
  // Also mount WS at root /ws for Electron frontend compatibility
  app.route('/', chatWsRoute)
  app.route('/api', createCheckpointsRoute(engine))
  app.route('/api', createCommandsRoute(engine))
  app.route('/api', createConfigRoute(engine))
  app.route('/api', createConfirmRoute({ engine }))
  app.route('/api', createDeskRoute(engine, hub))
  app.route('/api', createDevicesRoute(engine))
  app.route('/api', createDiaryRoute(engine))
  app.route('/api', createDmRoute(engine, hub))
  app.route('/api', createExperimentsRoute(engine))
  app.route('/api', createFsRoute(engine))
  app.route('/api', createHtmlPreviewRoute())
  app.route('/api', createMediaRoute(engine))
  app.route('/api', createMobileStaticRoute({ distDir: path.join(process.cwd(), 'dist', 'mobile-static') }))
  app.route('/api', createMobileWorkbenchRoute(engine))
  app.route('/api', createModelsRoute(engine))
  app.route('/api', createPluginsRoute(engine))
  app.route('/api', createPluginProxyRoute({ get: () => null, getPages: () => [], getWidgets: () => [] }))
  app.route('/api', createPreferencesRoute(engine, {}))
  app.route('/api', createProvidersRoute(engine))
  app.route('/api', createResourcesRoute(engine))
  app.route('/api', createServerIdentityRoute({
    hanakoHome: engine.hanakoHome,
    appVersion: engine.appVersion,
    getRuntimeContext: () => engine._runtimeContext,
  }))
  app.route('/api', createSessionProjectsRoute(engine))
  app.route('/api', createSessionsRoute(engine, hub))
  app.route('/api', createSettingsSnapshotRoute(engine, {}))
  app.route('/api', createSkillsRoute(engine))
  app.route('/api', createSpeechRecognitionRoute(engine))
  app.route('/api', createStudioWorkspacesRoute(engine))
  app.route('/api', createUploadRoute(engine))
  app.route('/api', createUsageRoute(engine))

  // ── Session permission mode ──
  app.get('/api/session-permission-mode', async (c) => {
    return c.json({
      mode: (engine as any).permissionMode || 'operate',
      accessMode: (engine as any).accessMode || 'operate',
      defaultMode: (engine as any).getSessionPermissionModeDefault?.() || 'ask',
    });
  });

  app.post('/api/session-permission-mode', async (c) => {
    const { mode } = await c.req.json().catch(() => ({}));
    (engine as any).setSessionPermissionMode?.(mode);
    return c.json({ ok: true, mode });
  });
  app.route('/api', createWebAuthRoute({
    hanakoHome: engine.hanakoHome,
    authService: { verify: async () => null, getUser: () => null },
  }))

  app.get('/api/agent/status', (c) => c.json({ connected: false }))

  // locales 静态文件（Electron 前端 i18n 需要）
  const localesDir = path.join(process.cwd(), 'locales')
  app.get('/locales/:file', (c) => {
    const file = c.req.param('file')
    // 安全防护：防止路径穿越
    if (file.includes('..') || file.includes('/') || file.includes('\\')) {
      return c.text('Forbidden', 403)
    }
    const filePath = path.join(localesDir, file)
    try {
      const content = fsSync.readFileSync(filePath, 'utf-8')
      const data = JSON.parse(content)
      return c.json(data)
    } catch {
      return c.text('Not Found', 404)
    }
  })

  // ═══ 启动 HTTP 服务 ═══
  // 端口优先级：SHADOW_PORT (dev-web) > PORT > 3000
  const port = Number(process.env.SHADOW_PORT ?? process.env.PORT ?? 3000)

  const server = serve({
    fetch: app.fetch,
    port,
  })

  // 注入 WebSocket 升级处理
  try {
    injectWebSocket(server)
    console.log('🔌 WebSocket support enabled')
  } catch {
    console.warn('[shadow] WebSocket support not available')
  }

  console.log(`🚀 Server running on http://localhost:${port}`)
  console.log(`📡 37 business routes mounted`)

  // ═══ 写 server-info.json（供 Electron / dev-web 发现 server）═══
  const crypto = await import('crypto')
  const token = process.env.SHADOW_TOKEN || crypto.randomBytes(16).toString('hex')
  const appVersion = process.env.SHADOW_VERSION || '0.0.0'
  // shadowHome 已在模块顶部解析并写入 process.env.SHADOW_HOME
  try { fsSync.mkdirSync(shadowHome, { recursive: true }) } catch {}
  const serverInfoPath = path.join(shadowHome, 'server-info.json')
  let actualPort = port
  const nodeServer = (server as any)?.server ?? server
  try {
    const addr = nodeServer?.address?.()
    if (addr && typeof addr === 'object' && addr.port) {
      actualPort = addr.port
    }
  } catch {}
  fsSync.writeFileSync(serverInfoPath, JSON.stringify({
    pid: process.pid,
    port: actualPort,
    host: '127.0.0.1',
    token,
    version: appVersion,
  }))
  try { fsSync.chmodSync(serverInfoPath, 0o600) } catch {}
  console.log(`[shadow] server-info.json written: port=${actualPort}, pid=${process.pid}`)

  // ═══ /api/shutdown 端点 ═══
  let shutdownPromise = null
  app.post('/api/shutdown', async (c) => {
    if (shutdownPromise) return c.json({ ok: true, message: 'shutdown already in progress' })
    shutdownPromise = (async () => {
      console.log('[shadow] Shutdown requested via /api/shutdown')
      try { fsSync.unlinkSync(serverInfoPath) } catch {}
      process.exit(0)
    })()
    return c.json({ ok: true })
  })

  // 关闭时清理 server-info.json
  const cleanup = () => {
    try { fsSync.unlinkSync(serverInfoPath) } catch {}
  }
  process.on('SIGINT', () => { cleanup(); process.exit(0) })
  process.on('SIGTERM', () => { cleanup(); process.exit(0) })
}

start().catch((err: any) => {
  console.error('[shadow] Failed to start server:', err)
  process.exit(1)
})

export default app

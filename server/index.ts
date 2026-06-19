// @ts-nocheck
/**
 * Rem Agent Server — HTTP + WebSocket API
 *
 * 启动方式：
 *   node server/index.js   （独立运行）
 *
 * 路由对齐 openhanako：挂载 37 个业务路由。
 */
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import path from 'path'
import * as fsSync from 'fs'
import { createNodeWebSocket } from '@hono/node-ws'

import { HanaEngine } from '../core/engine'
import { createAccessRoute } from './routes/access'
import { createAgentsRoute } from './routes/agents'
import { createAuthRoute } from './routes/auth'
import { createAvatarRoute } from './routes/avatar'
import { createBridgeRoute } from './routes/bridge'
import { createChannelsRoute } from './routes/channels'
import { createCharacterCardsRoute } from './routes/character-cards'
import { createChatRoute } from './routes/chat'
import { Hub } from '../hub/index'
import { setMiniMaxConfig } from '../lib/pi-sdk/index'
import { createCheckpointsRoute } from './routes/checkpoints'
import { createCommandsRoute } from './routes/commands'
import { createConfigRoute } from './routes/config'
import { createConfirmRoute } from './routes/confirm'
import { createDeskRoute } from './routes/desk'
import { createDevicesRoute } from './routes/devices'
import { createDiaryRoute } from './routes/diary'
import { createDmRoute } from './routes/dm'
import { createExperimentsRoute } from './routes/experiments'
import { createFsRoute } from './routes/fs'
import { createHtmlPreviewRoute } from './routes/html-preview'
import { createMediaRoute } from './routes/media'
import { createMobileStaticRoute } from './routes/mobile-static'
import { createMobileWorkbenchRoute } from './routes/mobile-workbench'
import { createModelsRoute } from './routes/models'
import { createPluginProxyRoute } from './routes/plugins'
import { createPreferencesRoute } from './routes/preferences'
import { createProvidersRoute } from './routes/providers'
import { createResourcesRoute } from './routes/resources'
import { createServerIdentityRoute } from './routes/server-identity'
import { createSessionProjectsRoute } from './routes/session-projects'
import { createSessionsRoute } from './routes/sessions'
import { createSettingsSnapshotRoute } from './routes/settings-snapshot'
import { createSkillsRoute } from './routes/skills'
import { createSpeechRecognitionRoute } from './routes/speech-recognition'
import { createStudioWorkspacesRoute } from './routes/studio-workspaces'
import { createUploadRoute } from './routes/upload'
import { createUsageRoute } from './routes/usage'
import { createWebAuthRoute } from './routes/web-auth'

const app = new Hono()

// 初始化 node-ws（提供真实的 upgradeWebSocket 实现）
// createNodeWebSocket 必须在所有路由挂载之前调用
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

// Middleware
app.use('*', cors())

// Health check
app.get('/', (c) => c.json({
  name: 'Rem Agent',
  version: '0.1.0',
  status: 'running',
}))

app.get('/health', (c) => c.json({ ok: true }))

// WebSocket endpoint - redirect to ws server
app.get('/ws', (c) => c.text('Use WebSocket server on port 8080'))

/**
 * 异步启动：创建引擎 → init() → 挂载路由 → 启动 HTTP 服务
 */
async function start() {
  // 初始化 HanaEngine
  const engine: any = new HanaEngine({
    hanakoHome: process.cwd(),
    productDir: process.cwd(),
    agentId: 'rem-default',
    appVersion: '0.1.0',
  } as any)
  ;(engine as any).hanakoHome = process.cwd()
  ;(engine as any).appVersion = '0.1.0'

  // 初始化默认 agent 目录
  const defaultAgentDir = path.join(process.cwd(), 'agents', 'rem-default')
  try { fsSync.mkdirSync(defaultAgentDir, { recursive: true }) } catch {}

  // 在 engine.init() 后创建真实 Hub（替代 dummy）
  // hub 将在 engine init 后创建，参见下方

  // 修补 agentDir getter
  try {
    Object.defineProperty(engine, 'agentDir', {
      get() { return defaultAgentDir },
      configurable: true,
    })
    console.log('[rem] Patched agentDir getter')
  } catch (e) {
    console.error('[rem] Failed to override agentDir getter:', (e as any).message)
  }

  // 设置 userDir
  try {
    const defaultUserDir = path.join(process.cwd(), 'user')
    fsSync.mkdirSync(defaultUserDir, { recursive: true })
    ;(engine as any).userDir = defaultUserDir
    console.log('[rem] Set userDir to', defaultUserDir)
  } catch (e) {
    console.error('[rem] Failed to set userDir:', (e as any).message)
  }

  console.log('[rem] engine.userDir =', engine.userDir)
  console.log('[rem] engine.agentDir =', engine.agentDir)

  // ═══ 关键：初始化引擎（加载 config、agents、plugins 等）═══
  console.log('[rem] Initializing engine...')
  try {
    await engine.init((msg: any) => console.log('[engine]', msg))
    console.log('[rem] Engine initialized')

    // ── 注入 MiniMax Token Plan 模型（占位 ModelRegistry 不持久化）──
    const mmModels = [
      { id: 'MiniMax-M3', name: 'MiniMax-M3', provider: 'minimax-token-plan', context: null, maxOutput: null },
    ]
    try {
      const models = (engine as any)._models
      if (models?._availableModels) {
        models._availableModels = [...models._availableModels, ...mmModels]
        console.log('[rem] Injected', mmModels.length, 'MiniMax model(s)')
      }
      // 注入 API key
      if (models?.providerRegistry) {
        models.providerRegistry.updateModelEntry('minimax-token-plan', 'MiniMax-M2.1', { name: 'MiniMax-M2.1' })
      }
      // 注入 provider API key 到 authStorage
      const authStorage = (engine as any).authStorage
      if (authStorage?.set) {
        authStorage.set('minimax-token-plan', {
          api_key: 'sk-cp-EcIO_LJLgf4g8oIe8HniPvvRuwbv3QMdQs0G2RFzlszzrquCq0xzWS1VlXXzmJ3BffHRfzS68CfwaQ75jE61f5_agAIQoO6wmnnZaIwdqqFHluWaxyIDIro',
          base_url: 'https://token-plan-cn.xiaomimimo.com/v1',
          api: 'anthropic-messages',
        })
      }
      // 注入到 pi-sdk session 创建层
      setMiniMaxConfig('sk-cp-EcIO_LJLgf4g8oIe8HniPvvRuwbv3QMdQs0G2RFzlszzrquCq0xzWS1VlXXzmJ3BffHRfzS68CfwaQ75jE61f5_agAIQoO6wmnnZaIwdqqFHluWaxyIDIro', 'https://api.minimaxi.com/v1')
      console.log('[rem] MiniMax API config injected to pi-sdk')
    } catch (e) {
      console.warn('[rem] MiniMax injection failed:', (e as any).message)
    }
  } catch (err) {
    console.error('[rem] engine.init() failed:', (err as any).message)
    // 继续启动，部分功能可能不可用
  }

  // ═══ 创建 Hub（bridge / desktop session 等依赖）═══
  let hub: any
  try {
    hub = new Hub({ engine })
    console.log('[rem] Hub created')
  } catch (err) {
    console.warn('[rem] Hub creation failed, using dummy:', (err as any).message)
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
  app.route('/api', createPluginProxyRoute(null))
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
  app.route('/api', createWebAuthRoute({
    hanakoHome: engine.hanakoHome,
    authService: { verify: async () => null, getUser: () => null },
  }))

  app.get('/api/agent/status', (c) => c.json({ connected: false }))

  // ═══ 启动 HTTP 服务 ═══
  const port = Number(process.env.PORT || 3000)

  const server = serve({
    fetch: app.fetch,
    port,
  })

  // 注入 WebSocket 升级处理
  try {
    injectWebSocket(server)
    console.log('🔌 WebSocket support enabled')
  } catch {
    console.warn('[rem] WebSocket support not available')
  }

  console.log(`🚀 Server running on http://localhost:${port}`)
  console.log(`📡 37 business routes mounted`)
}

start().catch((err: any) => {
  console.error('[rem] Failed to start server:', err)
  process.exit(1)
})

export default app

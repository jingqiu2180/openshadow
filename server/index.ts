// @ts-nocheck
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
import * as fsSync from 'fs'
import { createNodeWebSocket } from '@hono/node-ws'

import { HanaEngine } from '../core/engine.js'
import { createAccessRoute } from './routes/access.js'
import { createAgentsRoute } from './routes/agents.js'
import { createAuthRoute } from './routes/auth.js'
import { createAvatarRoute } from './routes/avatar.js'
import { createBridgeRoute } from './routes/bridge.js'
import { createChannelsRoute } from './routes/channels.js'
import { createCharacterCardsRoute } from './routes/character-cards.js'
import { createChatRoute } from './routes/chat.js'
import { Hub } from '../hub/index.js'
import { setMiniMaxConfig } from '../lib/pi-sdk/index.js'
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
    console.log('[shadow] Patched agentDir getter')
  } catch (e) {
    console.error('[shadow] Failed to override agentDir getter:', (e as any).message)
  }

  // 设置 userDir
  try {
    const defaultUserDir = path.join(process.cwd(), 'user')
    fsSync.mkdirSync(defaultUserDir, { recursive: true })
    ;(engine as any).userDir = defaultUserDir
    console.log('[shadow] Set userDir to', defaultUserDir)
  } catch (e) {
    console.error('[shadow] Failed to set userDir:', (e as any).message)
  }

  console.log('[shadow] engine.userDir =', engine.userDir)
  console.log('[shadow] engine.agentDir =', engine.agentDir)

  // ═══ 关键：初始化引擎（加载 config、agents、plugins 等）═══
  console.log('[shadow] Initializing engine...')
  try {
    await engine.init((msg: any) => console.log('[engine]', msg))
    console.log('[shadow] Engine initialized')

    // ── 注入 MiniMax Token Plan 模型（占位 ModelRegistry 不持久化）──
    // 关键：baseUrl 必须用 OpenAI 兼容端点（/v1/chat/completions）。
    // MiniMax 的 Anthropic 端点（/anthropic/v1/messages）走的是 Messages API，
    // 跟 OpenAI 客户端不兼容。这里直接走 OpenAI 兼容端点最稳。
    const mmModels = [
      { id: 'MiniMax-M3', name: 'MiniMax-M3', provider: 'minimax-token-plan', context: null, maxOutput: null },
    ]
    // ── 注入中国模型（DeepSeek / Qwen / GLM）────────────────
    const cnModels = [
      { id: 'deepseek-chat', name: 'DeepSeek-V3', provider: 'deepseek', context: 65536, maxOutput: 8192 },
      { id: 'deepseek-reasoner', name: 'DeepSeek-R1', provider: 'deepseek', context: 65536, maxOutput: 8192 },
      { id: 'qwen-plus', name: 'Qwen-Plus', provider: 'qwen', context: 131072, maxOutput: 8192 },
      { id: 'qwen-max', name: 'Qwen-Max', provider: 'qwen', context: 32768, maxOutput: 8192 },
      { id: 'qwen-turbo', name: 'Qwen-Turbo', provider: 'qwen', context: 1000000, maxOutput: 8192 },
      { id: 'glm-4-plus', name: 'GLM-4-Plus', provider: 'glm', context: 128000, maxOutput: 4096 },
      { id: 'glm-4-flash', name: 'GLM-4-Flash', provider: 'glm', context: 128000, maxOutput: 4096 },
    ]
    const allModels = [...mmModels, ...cnModels]
    try {
      const models = (engine as any)._models
      if (models?._availableModels) {
        models._availableModels = [...models._availableModels, ...allModels]
        console.log('[shadow] Injected', allModels.length, 'model(s):', allModels.map(m => m.id).join(', '))
      }
      // 注入 API key + 注册 provider
      if (models?.providerRegistry) {
        // 重写 minimax-token-plan 为 OpenAI 兼容端点（/v1/chat/completions）
        // 因为 chat-engine 走的是 OpenAI SDK，Anthropic Messages 端点会 404
        try { models.providerRegistry.saveProvider('minimax-token-plan', { base_url: 'https://api.minimaxi.com/v1', api: 'openai-completions', api_key: 'sk-cp-EcIO_LJLgf4g8oIe8HniPvvRuwbv3QMdQs0G2RFzlszzrquCq0xzWS1VlXXzmJ3BffHRfzS68CfwaQ75jE61f5_agAIQoO6wmnnZaIwdqqFHluWaxyIDIro', models: ['MiniMax-M3', 'MiniMax-M2.1'] }) } catch(e) { console.log('[shadow] saveProvider minimax-token-plan err:', (e as any).message) }
        models.providerRegistry.updateModelEntry('minimax-token-plan', 'MiniMax-M2.1', { name: 'MiniMax-M2.1' })
        // 注册中国模型 provider（持久化到 added-models.yaml）
        try { models.providerRegistry.saveProvider('deepseek', { base_url: 'https://api.deepseek.com/v1', api: 'openai-completions', api_key: '<你的 DeepSeek API Key>', models: ['deepseek-chat', 'deepseek-reasoner'] }) } catch(e) {}
        try { models.providerRegistry.saveProvider('qwen', { base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', api: 'openai-completions', api_key: '<你的 DashScope API Key>', models: ['qwen-plus', 'qwen-max', 'qwen-turbo'] }) } catch(e) {}
        try { models.providerRegistry.saveProvider('glm', { base_url: 'https://open.bigmodel.cn/api/paas/v4', api: 'openai-completions', api_key: '<你的智谱 API Key>', models: ['glm-4-plus', 'glm-4-flash'] }) } catch(e) {}
      }
      // 注入 provider API key 到 authStorage
      // minimax-token-plan 用 MiniMax 的 OpenAI 兼容端点（/v1/chat/completions）
      // 因为 server 端 chat-engine 走的是 OpenAI SDK，不会自动转 Anthropic Messages 协议
      const authStorage = (engine as any).authStorage
      if (authStorage?.set) {
        authStorage.set('minimax-token-plan', {
          api_key: 'sk-cp-EcIO_LJLgf4g8oIe8HniPvvRuwbv3QMdQs0G2RFzlszzrquCq0xzWS1VlXXzmJ3BffHRfzS68CfwaQ75jE61f5_agAIQoO6wmnnZaIwdqqFHluWaxyIDIro',
          base_url: 'https://api.minimaxi.com/v1',
          api: 'openai-completions',
        })
        authStorage.set('deepseek', {
          api_key: '<你的 DeepSeek API Key>',
          base_url: 'https://api.deepseek.com/v1',
          api: 'openai-completions',
        })
        authStorage.set('qwen', {
          api_key: '<你的 DashScope API Key>',
          base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
          api: 'openai-completions',
        })
        authStorage.set('glm', {
          api_key: '<你的智谱 API Key>',
          base_url: 'https://open.bigmodel.cn/api/paas/v4',
          api: 'openai-completions',
        })
      }
      // 注入到 pi-sdk session 创建层
      // 用 config.json 里的 minimax provider 配置（OpenAI 兼容端点）
      setMiniMaxConfig('sk-cp-EcIO_LJLgf4g8oIe8HniPvvRuwbv3QMdQs0G2RFzlszzrquCq0xzWS1VlXXzmJ3BffHRfzS68CfwaQ75jE61f5_agAIQoO6wmnnZaIwdqqFHluWaxyIDIro', 'https://api.minimaxi.com/v1')
      console.log('[shadow] MiniMax API config injected to pi-sdk')
      // 手动设置默认模型（因为 _modelRegistry 是占位实现，syncAndRefresh() 没法自动初始化）
      if (models && mmModels.length > 0) {
        models._defaultModel = mmModels[0];
        // 强制设置（绕过所有检查，确保 engine.currentModel 非 null）
        (engine as any).forceSetCurrentModel?.(mmModels[0]);
        console.log('[shadow] Default model set:', models._defaultModel?.id);
        console.log('[shadow] _availableModels:', models._availableModels?.length || 0);
        // 不调 syncAndRefresh()（保护逻辑可能有漏洞，直接跳过）
        // models.syncAndRefresh().catch((err: any) => {
        //   console.warn('[shadow] syncAndRefresh() after injection failed:', err?.message);
        // });
      }
    } catch (e) {
      console.warn('[shadow] MiniMax injection failed:', (e as any).message)
    }
  } catch (err) {
    console.error('[shadow] engine.init() failed:', (err as any).message)
    // 继续启动，部分功能可能不可用
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
    console.warn('[shadow] WebSocket support not available')
  }

  console.log(`🚀 Server running on http://localhost:${port}`)
  console.log(`📡 37 business routes mounted`)
}

start().catch((err: any) => {
  console.error('[shadow] Failed to start server:', err)
  process.exit(1)
})

export default app

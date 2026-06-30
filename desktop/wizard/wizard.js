/**
 * OpenShadow Wizard — desktop/wizard/wizard.js
 */

// ─── i18n strings ──────
const i18n = {
  'zh-CN': {
    appName: 'OpenShadow 启动向导',
    steps: ['选择语言', '你的名字', 'AI 供应商', '对话模型', '工作区'],
    next: '下一步 →',
    back: '← 上一步',
    finish: '启动 OpenShadow ✨',
    stepIndicator: (n, total) => `第 ${n} 步 / 共 ${total} 步`,
  },
  'en': {
    appName: 'OpenShadow Setup',
    steps: ['Language', 'Your name', 'AI Provider', 'Models', 'Workspace'],
    next: 'Next →',
    back: '← Back',
    finish: 'Launch OpenShadow ✨',
    stepIndicator: (n, total) => `Step ${n} of ${total}`,
  },
  'ja': {
    appName: 'OpenShadow セットアップ',
    steps: ['言語', 'お名前', 'AI プロバイダー', 'モデル', 'ワークスペース'],
    next: '次へ →',
    back: '← 戻る',
    finish: 'OpenShadow を起動 ✨',
    stepIndicator: (n, total) => `ステップ ${n} / ${total}`,
  },
  'ko': {
    appName: 'OpenShadow 설정',
    steps: ['언어', '이름', 'AI 공급자', '모델', '작업 공간'],
    next: '다음 →',
    back: '← 뒤로',
    finish: 'OpenShadow 시작 ✨',
    stepIndicator: (n, total) => `${n} / ${total} 단계`,
  },
}

// ─── State ─────────────────────────────────────────────────────────
const state = {
  step: 1,
  total: 5,
  ui: { language: 'zh-CN' },
  user: { name: '王帅' },
  memory: { enabled: true },
  provider: {
    builtinId: 'minimax',
    apiKey: '',
    isDefault: true,
  },
  models: {
    main: '',
    small: '',
    large: '',
  },
  workspace: {
    folders: [],
  },
  // builtins 从主进程通过 wizard:get-config IPC 获取（单源: provider-presets.ts）
  builtins: {},
  _validation: {
    1: () => !!state.ui.language,
    2: () => state.user.name.trim().length > 0,
    3: () => state.provider.apiKey.length > 0 || !state.builtins[state.provider.builtinId]?.requiresApiKey,
    4: () => state.models.main.length > 0,
    5: () => state.workspace.folders.length > 0,
  },
}

// ─── Builtin providers — 单源: desktop/src/react/utils/provider-presets.ts ───
// wizard 不再维护自己的供应商列表。builtins 数据通过 wizard:get-config IPC
// 从主进程获取，主进程 import provider-presets.ts 统一管理。
// state.builtins 在 boot() 中从 existing.builtins 填充。

// ─── DOM helpers ────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => Array.from(document.querySelectorAll(sel))

function t(key) { return i18n[state.ui.language]?.[key] ?? i18n['zh-CN'][key] }

// ─── IPC bridge (Electron preload exposes window.wizard) ────────────
// With contextIsolation:true, the preload exposes `window.wizard` via
// contextBridge.exposeInMainWorld. This file must ONLY use `window.wizard`
// (not a cached local variable) to avoid stale-reference or dead-zone issues.
//
// If `window.wizard` is missing (e.g. running in a plain browser), fall
// back to a no-op mock so the UI still works for visual testing.
if (!window.wizard) {
  console.warn('[wizard] window.wizard not present — using mock for dev')
  window.wizard = {
    getConfig: async () => ({
      providers: [],
      user: { name: '王帅' },
      ui: { language: 'zh-CN' },
      theme: 'warm-paper',
      security: { workspaceRoots: [] },
    }),
    saveConfig: async (cfg) => { console.log('[mock] saveConfig:', cfg); return { ok: true } },
    testConnection: async (provider) => {
      await new Promise(r => setTimeout(r, 800))
      return { ok: provider.apiKey.length > 0, latencyMs: 800, error: provider.apiKey.length === 0 ? 'No API key' : null }
    },
    pickFolder: async () => ['D:\\src\\aicoding\\openshadow'],
    done: () => {},
  }
} else {
  console.log('[wizard] window.wizard is present')
  // 防御：如果 done 是空函数（mock），给出提示
  if (typeof window.wizard.done !== 'function' || window.wizard.done.toString().includes('{}')) {
    console.warn('[wizard] window.wizard.done looks like a mock — IPC may not work in packaged app')
  }
}

// Use `window.wizard` directly (no local alias) to avoid any scoping issues.
// Every call below goes through `window.wizard` (aliased as `wiz` for brevity
// inside async functions to avoid the `this` pitfall).

// ─── Step renderers ─────────────────────────────────────────────────
const stepRenderers = {
  1: renderStepLanguage,
  2: renderStepUser,
  3: renderStepProvider,
  4: renderStepModels,
  5: renderStepWorkspace,
}

function renderStepLanguage(container) {
  const langs = [
    { code: 'zh-CN', flag: '🇨🇳', name: '简体中文', local: 'Simplified Chinese' },
    { code: 'en',    flag: '🇺🇸', name: 'English',     local: 'English (US)' },
    { code: 'ja',    flag: '🇯🇵', name: '日本語',      local: 'Japanese' },
    { code: 'ko',    flag: '🇰🇷', name: '한국어',      local: 'Korean' },
  ]
  container.innerHTML = `
    <div class="step">
      <h2>选择你的语言</h2>
      <p class="step-desc">OpenShadow 会用这种语言和你对话。选择之后还可以随时在设置里改。</p>
      <div class="lang-grid">
        ${langs.map(l => `
          <button type="button" class="lang-card ${state.ui.language === l.code ? 'selected' : ''}" data-lang="${l.code}">
            <div class="lang-flag">${l.flag}</div>
            <div class="lang-name">${l.name}</div>
            <div class="lang-local">${l.local}</div>
          </button>
        `).join('')}
      </div>
    </div>
  `
  $$('.lang-card').forEach(card => {
    card.onclick = () => {
      state.ui.language = card.dataset.lang
      render()
    }
  })
}

function renderStepUser(container) {
  container.innerHTML = `
    <div class="step">
      <h2>你的名字</h2>
      <p class="step-desc">OpenShadow 会用这个名字称呼你。改名字随时在设置里改。</p>
      <div class="input-group">
        <label for="userName">你叫什么?</label>
        <input type="text" id="userName" class="input" value="${state.user.name}" placeholder="王帅" />
        <span class="input-hint">默认是「王帅」,你可以改成任何你喜欢的叫法</span>
      </div>
      <div class="toggle-row" id="memoryToggle">
        <div>
          <strong>开启长期记忆</strong>
          <div class="step-desc" style="margin-top:4px">OpenShadow 会记住你告诉它的重要信息(API key 不存)</div>
        </div>
        <button type="button" class="toggle ${state.memory.enabled ? 'on' : ''}" id="memoryBtn" aria-label="记忆开关"></button>
      </div>
    </div>
  `
  $('#userName').oninput = (e) => { state.user.name = e.target.value; updateNavState() }
  $('#memoryToggle').onclick = (e) => {
    if (e.target.id !== 'memoryBtn') return
    state.memory.enabled = !state.memory.enabled
    $('#memoryBtn').className = 'toggle' + (state.memory.enabled ? ' on' : '')
  }
}

function renderStepProvider(container) {
  const builtinEntries = Object.entries(state.builtins)
  const selectedSpec = state.builtins[state.provider.builtinId]
  const models = selectedSpec?.models ?? []
  container.innerHTML = `
    <div class="step">
      <h2>选择一个 AI 供应商</h2>
      <p class="step-desc">OpenShadow 兼容 OpenAI API,所以支持多家供应商。选一个填上 API key,OpenShadow 会自动测试连接。</p>

      <div class="input-group">
        <label for="builtinSelect">供应商</label>
        <select id="builtinSelect" class="provider-select">
          ${builtinEntries.map(([id, spec]) => `
            <option value="${id}" ${state.provider.builtinId === id ? 'selected' : ''}>
              ${spec.label} ${spec.note ? '· ' + spec.note : ''}
            </option>
          `).join('')}
        </select>
      </div>

      ${selectedSpec?.requiresApiKey ? `
        <div class="input-group">
          <label for="apiKey">API Key</label>
          <input type="password" id="apiKey" class="input" value="${state.provider.apiKey}" placeholder="sk-..." />
          <span class="input-hint">API key 只存在本地 config.json,不会上传任何服务器</span>
        </div>
      ` : ''}

      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button type="button" class="test-conn-btn" id="testConnBtn">测试连接</button>
        <span class="step-desc" id="testConnHint">会用 1 个 token 的最小请求验证 key 是否可用</span>
      </div>
      <div class="test-conn-result" id="testConnResult"></div>
    </div>
  `
  $('#builtinSelect').onchange = (e) => {
    state.provider.builtinId = e.target.value
    state.provider.apiKey = ''  // reset key on provider change
    render()
    updateNavState()
  }
  const apiKeyInput = $('#apiKey')
  if (apiKeyInput) apiKeyInput.oninput = (e) => { state.provider.apiKey = e.target.value; updateNavState() }
  $('#testConnBtn').onclick = async () => {
    const resultEl = $('#testConnResult')
    const btn = $('#testConnBtn')
    resultEl.className = 'test-conn-result show'
    resultEl.textContent = '测试中…'
    btn.disabled = true
    try {
      const res = await window.wizard.testConnection({
        id: state.provider.builtinId,
        type: selectedSpec.type,
        apiKey: state.provider.apiKey,
        baseUrl: '',  // main process fills from builtin
        models: models,
      })
      if (res.ok) {
        resultEl.className = 'test-conn-result show ok'
        resultEl.textContent = `✓ 连接成功 (${res.latencyMs}ms, model: ${res.modelUsed})`
      } else {
        resultEl.className = 'test-conn-result show err'
        resultEl.textContent = `✗ 失败: ${res.error || '未知错误'}`
      }
    } catch (e) {
      resultEl.className = 'test-conn-result show err'
      resultEl.textContent = `✗ 错误: ${e.message}`
    } finally {
      btn.disabled = false
    }
  }
}

function renderStepModels(container) {
  const models = state.builtins[state.provider.builtinId]?.models ?? []
  if (models.length === 0) {
    state.models = { main: state.models.main || 'custom', small: state.models.small || 'custom', large: state.models.large || 'custom' }
  } else {
    if (!models.includes(state.models.main)) state.models.main = models[0]
    if (!models.includes(state.models.small)) state.models.small = models[Math.min(1, models.length - 1)]
    if (!models.includes(state.models.large)) state.models.large = models[models.length - 1]
  }
  const modelSelect = (role, current) => {
    if (models.length === 0) {
      return `<input type="text" class="input" data-role="${role}" value="${current}" placeholder="model name" />`
    }
    return `
      <select class="provider-select" data-role="${role}">
        ${models.map(m => `<option value="${m}" ${current === m ? 'selected' : ''}>${m}</option>`).join('')}
      </select>
    `
  }
  container.innerHTML = `
    <div class="step">
      <h2>为不同任务选模型</h2>
      <p class="step-desc">OpenShadow 把任务分 3 档:主对话用大模型,小工具用便宜模型,长任务用大模型。也可以都选同一个。</p>
      <div class="model-row">
        <label>主对话 (main)</label>
        ${modelSelect('main', state.models.main)}
      </div>
      <div class="model-row">
        <label>小工具 (small)</label>
        ${modelSelect('small', state.models.small)}
      </div>
      <div class="model-row">
        <label>长任务 (large)</label>
        ${modelSelect('large', state.models.large)}
      </div>
      ${models.length === 0 ? '<span class="input-hint">Ollama 模型动态,这里手动填模型名 (例如 llama3.1:8b)</span>' : ''}
    </div>
  `
  $$('[data-role]').forEach(el => {
    el.onchange = (e) => { state.models[e.target.dataset.role] = e.target.value; updateNavState() }
  })
}

function renderStepWorkspace(container) {
  container.innerHTML = `
    <div class="step">
      <h2>选择工作区目录</h2>
      <p class="step-desc">OpenShadow 在这些目录下有完整权限(读/写/删)。之后可以随时在设置里加/删。</p>
      <button type="button" class="test-conn-btn" id="addFolderBtn">+ 添加目录</button>
      <div class="folder-list" id="folderList">
        ${state.workspace.folders.length === 0
          ? '<span class="input-hint">还没选,点上面按钮选至少一个目录</span>'
          : state.workspace.folders.map(f => `
              <div class="folder-item">
                <span>📁 ${f}</span>
                <button type="button" class="folder-remove" data-path="${f}">×</button>
              </div>
            `).join('')
        }
      </div>
    </div>
  `
  $('#addFolderBtn').onclick = async () => {
    const paths = await window.wizard.pickFolder()
    if (paths && paths.length > 0) {
      for (const p of paths) {
        if (!state.workspace.folders.includes(p)) state.workspace.folders.push(p)
      }
      render()
      updateNavState()
    }
  }
  $$('.folder-remove').forEach(btn => {
    btn.onclick = () => {
      state.workspace.folders = state.workspace.folders.filter(f => f !== btn.dataset.path)
      render()
      updateNavState()
    }
  })
}

// ─── Progress + nav ─────────────────────────────────────────────────
function renderProgress() {
  const container = $('#progress')
  const steps = i18n[state.ui.language]?.steps ?? i18n['zh-CN'].steps
  container.innerHTML = steps.map((label, i) => {
    const n = i + 1
    const cls = n === state.step ? 'active' : (n < state.step ? 'done' : '')
    const display = n < state.step ? '✓' : n
    return `<div class="progress-dot ${cls}" title="${label}">${display}</div>`
  }).join('')
}

function updateNavState() {
  const valid = state._validation[state.step]?.() ?? true
  $('#backBtn').disabled = state.step === 1
  $('#nextBtn').disabled = !valid
  $('#nextBtn').textContent = state.step === state.total ? t('finish') : t('next')
  $('#stepIndicator').textContent = t('stepIndicator')(state.step, state.total)
  $('#langPill').textContent = ({ 'zh-CN': '中文', 'en': 'English', 'ja': '日本語', 'ko': '한국어' })[state.ui.language]
}

function render() {
  renderProgress()
  const container = $('#stepContainer')
  stepRenderers[state.step](container)
  updateNavState()
}

// ─── Save / finish ──────────────────────────────────────────────────
async function finish() {
  const nextBtn = $('#nextBtn')
  nextBtn.disabled = true
  nextBtn.textContent = '保存中…'
  console.log('[wizard] finish() started')
  try {
    const builtin = state.builtins[state.provider.builtinId]
    const cfg = {
      wizard: { completed: true, completedAt: new Date().toISOString() },
      ui: state.ui,
      user: state.user,
      memory: { enabled: state.memory.enabled },
      providers: [{
        id: state.provider.builtinId,
        type: builtin.type,
        apiKey: state.provider.apiKey,
        baseUrl: builtin.url || '',  // 优先用 builtin url，main.cjs 会兜底填充
        models: builtin.models,
        isDefault: true,
      }],
      models: {
        main: `${state.provider.builtinId}::${state.models.main}`,
        small: `${state.provider.builtinId}::${state.models.small}`,
        large: `${state.provider.builtinId}::${state.models.large}`,
      },
      theme: 'warm-paper',
      security: { workspaceRoots: state.workspace.folders },
    }
    console.log('[wizard] calling saveConfig...')
    const saveResult = await window.wizard.saveConfig(cfg)
    console.log('[wizard] saveConfig result:', saveResult)
    if (!saveResult || !saveResult.ok) {
      throw new Error(saveResult?.error || '保存返回异常')
    }
    console.log('[wizard] calling done()...')
    if (typeof window.wizard.done !== 'function') {
      throw new Error('window.wizard.done 不可用')
    }
    window.wizard.done()
    console.log('[wizard] done() sent')
  } catch (e) {
    console.error('[wizard] save failed:', e)
    alert('保存失败: ' + e.message)
    nextBtn.disabled = false
    nextBtn.textContent = t('finish')
  }
}

// ─── Boot ───────────────────────────────────────────────────────────
async function boot() {
  try {
    // Try to pull existing config (resumable wizard) + builtins from main process
    try {
      const existing = await window.wizard.getConfig()
      if (existing) {
        // Capture builtins from main process (single source: provider-presets.ts)
        if (existing.builtins && Object.keys(existing.builtins).length > 0) {
          state.builtins = existing.builtins
        }
        if (existing.user?.name) state.user.name = existing.user.name
        if (existing.ui?.language) state.ui.language = existing.ui.language
        if (existing.providers?.[0]) {
          state.provider.builtinId = existing.providers[0].id
          state.provider.apiKey = existing.providers[0].apiKey
        }
        if (existing.security?.workspaceRoots) {
          state.workspace.folders = [...existing.security.workspaceRoots]
        }
      }
    } catch (e) {
      console.warn('[wizard] getConfig failed, starting fresh:', e.message)
    }

    // 兜底: 如果 builtins 为空（mock 或 IPC 失败），提供最小默认值
    if (Object.keys(state.builtins).length === 0) {
      console.warn('[wizard] builtins is empty — using minimal fallback')
      state.builtins = {
        minimax: { label: 'MiniMax', type: 'openai', models: ['abab6.5s-chat'], requiresApiKey: true, url: 'https://api.minimax.chat/v1' },
        openai:  { label: 'OpenAI',  type: 'openai', models: ['gpt-4o', 'gpt-4o-mini'], requiresApiKey: true, url: 'https://api.openai.com/v1' },
        ollama:  { label: 'Ollama (本地)', type: 'ollama', models: [], requiresApiKey: false, url: 'http://localhost:11434/v1' },
      }
    }

    $('#backBtn').onclick = () => {
      if (state.step > 1) { state.step--; render() }
    }
    $('#nextBtn').onclick = () => {
      if (state.step < state.total) { state.step++; render() }
      else finish()
    }

    render()
  } catch (e) {
    // Show fatal error inline so blank window has a clue
    console.error('[wizard] boot failed:', e)
    const root = document.querySelector('main.wizard') || document.body
    root.innerHTML = `
      <div style="padding:40px;font-family:monospace;color:#c00;background:#fff5f5;border:2px solid #c00;margin:20px;border-radius:8px;">
        <h2>⚠ Wizard 启动失败</h2>
        <p><strong>${e.message}</strong></p>
        <pre style="background:#fff;padding:10px;overflow:auto;font-size:11px;">${(e.stack || '').slice(0, 800)}</pre>
        <p style="color:#666;font-size:12px;">检查 DevTools (View → Toggle Developer Tools 或 F12) 获取更多日志</p>
      </div>
    `
  }
}

boot()

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

    // Step 1: Language
    langTitle: '选择你的语言',
    langDesc: 'OpenShadow 会用这种语言和你对话。选择之后还可以随时在设置里改。',

    // Step 2: User name
    userTitle: '你的名字',
    userDesc: 'OpenShadow 会用这个名字称呼你。改名字随时在设置里改。',
    userLabel: '你叫什么?',
    userPlaceholder: '王帅',
    userHint: '默认是「王帅」,你可以改成任何你喜欢的叫法',
    memoryTitle: '开启长期记忆',
    memoryDesc: 'OpenShadow 会记住你告诉它的重要信息(API key 不存)',

    // Step 3: Provider
    providerTitle: '选择一个 AI 供应商',
    providerDesc: 'OpenShadow 兼容 OpenAI API,所以支持多家供应商。选一个填上 API key,OpenShadow 会自动测试连接。',
    providerLabel: '供应商',
    apiKeyLabel: 'API Key',
    apiKeyPlaceholder: 'sk-...',
    apiKeyHint: 'API key 只存在本地 config.json,不会上传任何服务器',
    testConnBtn: '测试连接',
    testConnHint: '会用 1 个 token 的最小请求验证 key 是否可用',
    testConnTesting: '测试中…',
    testConnOk: (latencyMs, model) => `✓ 连接成功 (${latencyMs}ms, model: ${model})`,
    testConnFail: (err) => `✗ 失败: ${err || '未知错误'}`,
    testConnError: (msg) => `✗ 错误: ${msg}`,

    // Step 4: Models
    modelsTitle: '为不同任务选模型',
    modelsDesc: 'OpenShadow 把任务分 3 档:主对话用大模型,小工具用便宜模型,长任务用大模型。也可以都选同一个。',
    modelMainLabel: '主对话 (main)',
    modelSmallLabel: '小工具 (small)',
    modelLargeLabel: '长任务 (large)',
    modelPlaceholder: 'model name',
    modelOllamaHint: 'Ollama 模型动态,这里手动填模型名 (例如 llama3.1:8b)',

    // Step 5: Workspace
    workspaceTitle: '选择工作区目录',
    workspaceDesc: 'OpenShadow 在这些目录下有完整权限(读/写/删)。之后可以随时在设置里加/删。',
    workspaceAddBtn: '+ 添加目录',
    workspaceEmptyHint: '还没选,点上面按钮选至少一个目录',

    // Boot fatal
    bootFatalTitle: '⚠ Wizard 启动失败',
    bootFatalTail: '请检查控制台输出后向开发者反馈',

    // Save
    saving: '保存中…',
    saveFail: (msg) => `保存失败: ${msg}`,
  },
  'en': {
    appName: 'OpenShadow Setup',
    steps: ['Language', 'Your name', 'AI Provider', 'Models', 'Workspace'],
    next: 'Next →',
    back: '← Back',
    finish: 'Launch OpenShadow ✨',
    stepIndicator: (n, total) => `Step ${n} of ${total}`,

    langTitle: 'Choose your language',
    langDesc: 'OpenShadow will use this language to talk to you. You can change it later in Settings.',

    userTitle: 'Your name',
    userDesc: 'OpenShadow will use this name to address you. You can change it in Settings anytime.',
    userLabel: 'What should we call you?',
    userPlaceholder: 'Your name',
    userHint: 'Default is "Your name". You can change it to anything you like.',
    memoryTitle: 'Enable long-term memory',
    memoryDesc: 'OpenShadow will remember important info you tell it (API keys are NOT stored).',

    providerTitle: 'Choose an AI provider',
    providerDesc: 'OpenShadow is OpenAI-compatible, so it works with many providers. Pick one and fill in your API key — OpenShadow will test the connection automatically.',
    providerLabel: 'Provider',
    apiKeyLabel: 'API Key',
    apiKeyPlaceholder: 'sk-...',
    apiKeyHint: 'API keys are stored only in local config.json, never uploaded.',
    testConnBtn: 'Test connection',
    testConnHint: 'Uses a 1-token request to verify the key.',
    testConnTesting: 'Testing…',
    testConnOk: (latencyMs, model) => `✓ Connected (${latencyMs}ms, model: ${model})`,
    testConnFail: (err) => `✗ Failed: ${err || 'Unknown error'}`,
    testConnError: (msg) => `✗ Error: ${msg}`,

    modelsTitle: 'Pick a model for each task',
    modelsDesc: 'OpenShadow splits work into 3 tiers: chat uses a strong model, tools use a cheap model, long tasks use a strong model. You can pick the same model for all.',
    modelMainLabel: 'Chat (main)',
    modelSmallLabel: 'Tools (small)',
    modelLargeLabel: 'Long tasks (large)',
    modelPlaceholder: 'model name',
    modelOllamaHint: 'Ollama models are dynamic — type the model name manually (e.g. llama3.1:8b)',

    workspaceTitle: 'Pick workspace folders',
    workspaceDesc: 'OpenShadow has full read/write/delete access in these folders. You can add or remove folders later in Settings.',
    workspaceAddBtn: '+ Add folder',
    workspaceEmptyHint: 'Nothing picked yet. Click the button above to pick at least one folder.',

    bootFatalTitle: '⚠ Wizard failed to start',
    bootFatalTail: 'Check the console output and report to the developer',

    saving: 'Saving…',
    saveFail: (msg) => `Save failed: ${msg}`,
  },
  'ja': {
    appName: 'OpenShadow セットアップ',
    steps: ['言語', 'お名前', 'AI プロバイダー', 'モデル', 'ワークスペース'],
    next: '次へ →',
    back: '← 戻る',
    finish: 'OpenShadow を起動 ✨',
    stepIndicator: (n, total) => `ステップ ${n} / ${total}`,

    langTitle: '言語を選択',
    langDesc: 'OpenShadow はこの言語で話します。設定でいつでも変更できます。',

    userTitle: 'お名前',
    userDesc: 'OpenShadow はこの名前で呼びます。設定でいつでも変更できます。',
    userLabel: 'お名前は？',
    userPlaceholder: 'お名前',
    userHint: 'デフォルトは「お名前」。好きな呼び名に変更できます。',
    memoryTitle: '長期メモリを有効化',
    memoryDesc: 'OpenShadow は重要な情報を記憶します（API キーは保存しません）',

    providerTitle: 'AI プロバイダーを選択',
    providerDesc: 'OpenShadow は OpenAI 互換なので、多くのプロバイダーに対応しています。API キーを入力すれば自動で接続テストします。',
    providerLabel: 'プロバイダー',
    apiKeyLabel: 'API キー',
    apiKeyPlaceholder: 'sk-...',
    apiKeyHint: 'API キーはローカルの config.json にのみ保存され、アップロードされません',
    testConnBtn: '接続テスト',
    testConnHint: '最小リクエストでキーの有効性を検証します',
    testConnTesting: 'テスト中…',
    testConnOk: (latencyMs, model) => `✓ 接続成功 (${latencyMs}ms, model: ${model})`,
    testConnFail: (err) => `✗ 失敗: ${err || '不明なエラー'}`,
    testConnError: (msg) => `✗ エラー: ${msg}`,

    modelsTitle: 'タスクごとにモデルを選択',
    modelsDesc: 'OpenShadow はタスクを3段階に分けます：チャットは大モデル、ツールは安価なモデル、長時間タスクは大モデル。全部同じでも可。',
    modelMainLabel: 'チャット (main)',
    modelSmallLabel: 'ツール (small)',
    modelLargeLabel: '長時間タスク (large)',
    modelPlaceholder: 'モデル名',
    modelOllamaHint: 'Ollama モデルは動的なので、手動で入力してください（例: llama3.1:8b）',

    workspaceTitle: 'ワークスペースフォルダーを選択',
    workspaceDesc: 'OpenShadow はこれらのフォルダーで読み/書き/削除の全権限を持ちます。設定でいつでも追加/削除できます。',
    workspaceAddBtn: '+ フォルダーを追加',
    workspaceEmptyHint: 'まだ未選択。上のボタンから最低1つ選んでください',

    bootFatalTitle: '⚠ Wizard の起動に失敗',
    bootFatalTail: 'コンソール出力を確認して開発者に報告してください',

    saving: '保存中…',
    saveFail: (msg) => `保存失敗: ${msg}`,
  },
  'ko': {
    appName: 'OpenShadow 설정',
    steps: ['언어', '이름', 'AI 공급자', '모델', '작업 공간'],
    next: '다음 →',
    back: '← 뒤로',
    finish: 'OpenShadow 시작 ✨',
    stepIndicator: (n, total) => `${n} / ${total} 단계`,

    langTitle: '언어 선택',
    langDesc: 'OpenShadow 가 이 언어로 대화합니다. 설정에서 언제든지 변경할 수 있습니다.',

    userTitle: '이름',
    userDesc: 'OpenShadow 가 이 이름으로 부릅니다. 설정에서 언제든지 변경할 수 있습니다.',
    userLabel: '이름이 무엇입니까?',
    userPlaceholder: '이름',
    userHint: '기본값은 "이름"입니다. 원하는 대호칭으로 변경할 수 있습니다.',
    memoryTitle: '장기 기억 활성화',
    memoryDesc: 'OpenShadow 가 중요한 정보를 기억합니다 (API 키는 저장 안 함)',

    providerTitle: 'AI 공급자 선택',
    providerDesc: 'OpenShadow 는 OpenAI 호환이므로 여러 공급자를 지원합니다. API 키를 입력하면 OpenShadow 가 자동으로 연결을 테스트합니다.',
    providerLabel: '공급자',
    apiKeyLabel: 'API 키',
    apiKeyPlaceholder: 'sk-...',
    apiKeyHint: 'API 키는 로컬 config.json에만 저장되며 업로드되지 않습니다',
    testConnBtn: '연결 테스트',
    testConnHint: '최소 요청으로 키 유효성을 검증합니다',
    testConnTesting: '테스트 중…',
    testConnOk: (latencyMs, model) => `✓ 연결 성공 (${latencyMs}ms, model: ${model})`,
    testConnFail: (err) => `✗ 실패: ${err || '알 수 없는 오류'}`,
    testConnError: (msg) => `✗ 오류: ${msg}`,

    modelsTitle: '작업별 모델 선택',
    modelsDesc: 'OpenShadow 는 작업을 3 단계로 나눕니다: 대화는 대형 모델, 도구는 저렴한 모델, 장기 작업은 대형 모델. 모두 같게 선택해도 됩니다.',
    modelMainLabel: '대화 (main)',
    modelSmallLabel: '도구 (small)',
    modelLargeLabel: '장기 작업 (large)',
    modelPlaceholder: '모델 이름',
    modelOllamaHint: 'Ollama 모델은 동적이므로 직접 입력하세요 (예: llama3.1:8b)',

    workspaceTitle: '작업 공간 폴더 선택',
    workspaceDesc: 'OpenShadow 는 이러한 폴더에서 읽기/쓰기/삭제 권한을 갖습니다. 설정에서 나중에 추가/삭제할 수 있습니다.',
    workspaceAddBtn: '+ 폴더 추가',
    workspaceEmptyHint: '아직 선택하지 않았습니다. 위 버튼을 눌러 최소 1개 폴더를 선택하세요',

    bootFatalTitle: '⚠ Wizard 시작 실패',
    bootFatalTail: '콘솔 출력을 확인하고 개발자에게 보고하세요',

    saving: '저장 중…',
    saveFail: (msg) => `저장 실패: ${msg}`,
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
      <h2>${t('langTitle')}</h2>
      <p class="step-desc">${t('langDesc')}</p>
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
      <h2>${t('userTitle')}</h2>
      <p class="step-desc">${t('userDesc')}</p>
      <div class="input-group">
        <label for="userName">${t('userLabel')}</label>
        <input type="text" id="userName" class="input" value="${state.user.name}" placeholder="${t('userPlaceholder')}" />
        <span class="input-hint">${t('userHint')}</span>
      </div>
      <div class="toggle-row" id="memoryToggle">
        <div>
          <strong>${t('memoryTitle')}</strong>
          <div class="step-desc" style="margin-top:4px">${t('memoryDesc')}</div>
        </div>
        <button type="button" class="toggle ${state.memory.enabled ? 'on' : ''}" id="memoryBtn" aria-label="${t('memoryTitle')}"></button>
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
      <h2>${t('providerTitle')}</h2>
      <p class="step-desc">${t('providerDesc')}</p>

      <div class="input-group">
        <label for="builtinSelect">${t('providerLabel')}</label>
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
          <label for="apiKey">${t('apiKeyLabel')}</label>
          <input type="password" id="apiKey" class="input" value="${state.provider.apiKey}" placeholder="${t('apiKeyPlaceholder')}" />
          <span class="input-hint">${t('apiKeyHint')}</span>
        </div>
      ` : ''}

      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button type="button" class="test-conn-btn" id="testConnBtn">${t('testConnBtn')}</button>
        <span class="step-desc" id="testConnHint">${t('testConnHint')}</span>
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
    resultEl.textContent = t('testConnTesting')
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
        resultEl.textContent = t('testConnOk')(res.latencyMs, res.modelUsed)
      } else {
        resultEl.className = 'test-conn-result show err'
        resultEl.textContent = t('testConnFail')(res.error)
      }
    } catch (e) {
      resultEl.className = 'test-conn-result show err'
      resultEl.textContent = t('testConnError')(e.message)
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
      return `<input type="text" class="input" data-role="${role}" value="${current}" placeholder="${t('modelPlaceholder')}" />`
    }
    return `
      <select class="provider-select" data-role="${role}">
        ${models.map(m => `<option value="${m}" ${current === m ? 'selected' : ''}>${m}</option>`).join('')}
      </select>
    `
  }
  container.innerHTML = `
    <div class="step">
      <h2>${t('modelsTitle')}</h2>
      <p class="step-desc">${t('modelsDesc')}</p>
      <div class="model-row">
        <label>${t('modelMainLabel')}</label>
        ${modelSelect('main', state.models.main)}
      </div>
      <div class="model-row">
        <label>${t('modelSmallLabel')}</label>
        ${modelSelect('small', state.models.small)}
      </div>
      <div class="model-row">
        <label>${t('modelLargeLabel')}</label>
        ${modelSelect('large', state.models.large)}
      </div>
      ${models.length === 0 ? `<span class="input-hint">${t('modelOllamaHint')}</span>` : ''}
    </div>
  `
  $$('[data-role]').forEach(el => {
    el.onchange = (e) => { state.models[e.target.dataset.role] = e.target.value; updateNavState() }
  })
}

function renderStepWorkspace(container) {
  container.innerHTML = `
    <div class="step">
      <h2>${t('workspaceTitle')}</h2>
      <p class="step-desc">${t('workspaceDesc')}</p>
      <button type="button" class="test-conn-btn" id="addFolderBtn">${t('workspaceAddBtn')}</button>
      <div class="folder-list" id="folderList">
        ${state.workspace.folders.length === 0
          ? `<span class="input-hint">${t('workspaceEmptyHint')}</span>`
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
  $('#backBtn').disabled = state.step === 1
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
  nextBtn.textContent = t('saving')
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
        baseUrl: builtin.baseUrl || builtin.url || '',  // 兼容两种字段名
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
    // 10秒后如果窗口还在，说明主进程没关闭窗口，给用户一个提示
    setTimeout(() => {
      if (document.body) {
        console.warn('[wizard] window still open after 10s — main process may not have received done signal')
        nextBtn.disabled = false
        nextBtn.textContent = t('finish')
      }
    }, 10000)
  } catch (e) {
    console.error('[wizard] save failed:', e)
    alert(t('saveFail')(e.message))
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

    // 兜底: 如果 builtins 为空（IPC 失败），提供完整默认值（与 main.cjs PROVIDER_MODELS 对齐）
    if (Object.keys(state.builtins).length === 0) {
      console.warn('[wizard] builtins is empty — using full fallback')
      state.builtins = {
        ollama:    { label: 'Ollama (本地)', type: 'openai', models: [], requiresApiKey: false, baseUrl: 'http://localhost:11434/v1' },
        dashscope: { label: 'DashScope (Qwen)', type: 'openai', models: ['qwen-plus', 'qwen-turbo', 'qwen-max', 'qwen3-235b-a22b'], requiresApiKey: true, baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
        openai:    { label: 'OpenAI', type: 'openai', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-mini', 'o3-mini'], requiresApiKey: true, baseUrl: 'https://api.openai.com/v1' },
        gemini:    { label: 'Google Gemini', type: 'gemini', models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'], requiresApiKey: true, baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
        deepseek:  { label: 'DeepSeek', type: 'openai', models: ['deepseek-chat', 'deepseek-reasoner'], requiresApiKey: true, baseUrl: 'https://api.deepseek.com' },
        volcengine:{ label: 'Volcengine (豆包)', type: 'openai', models: ['doubao-pro-32k', 'doubao-lite-32k', 'deepseek-r1-2501', 'deepseek-v3-250324'], requiresApiKey: true, baseUrl: 'https://ark.cn-beijing.volces.com/api/v3' },
        moonshot:  { label: 'Moonshot (Kimi)', type: 'openai', models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'], requiresApiKey: true, baseUrl: 'https://api.moonshot.cn/v1' },
        'kimi-coding': { label: 'Kimi Coding Plan', type: 'anthropic', models: ['kimi-coding'], requiresApiKey: true, baseUrl: 'https://api.kimi.com/coding/' },
        zhipu:     { label: 'Zhipu (GLM)', type: 'openai', models: ['glm-4-plus', 'glm-4-flash', 'glm-4-air', 'glm-4-airx'], requiresApiKey: true, baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
        siliconflow:{ label: 'SiliconFlow', type: 'openai', models: ['Qwen/Qwen2.5-7B-Instruct', 'deepseek-ai/DeepSeek-V2.5', 'Pro/Qwen/Qwen2.5-7B-Instruct'], requiresApiKey: true, baseUrl: 'https://api.siliconflow.cn/v1' },
        groq:      { label: 'Groq', type: 'openai', models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768', 'qwen-2.5-32b'], requiresApiKey: true, baseUrl: 'https://api.groq.com/openai/v1' },
        mistral:   { label: 'Mistral', type: 'openai', models: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'], requiresApiKey: true, baseUrl: 'https://api.mistral.ai/v1' },
        minimax:   { label: 'MiniMax', type: 'anthropic', models: ['abab6.5s-chat', 'abab6.5g-chat', 'abab6.5t-chat'], requiresApiKey: true, baseUrl: 'https://api.minimaxi.com/anthropic' },
        'minimax-token-plan': { label: 'MiniMax Token Plan', type: 'anthropic', models: ['MiniMax-M3'], requiresApiKey: true, baseUrl: 'https://api.minimaxi.com/anthropic' },
        openrouter:{ label: 'OpenRouter', type: 'openai', models: [], requiresApiKey: true, baseUrl: 'https://openrouter.ai/api/v1' },
        mimo:      { label: 'Xiaomi (MiMo)', type: 'openai', models: ['mimo-chat'], requiresApiKey: true, baseUrl: 'https://api.xiaomimimo.com/v1' },
        'mimo-token-plan': { label: 'Xiaomi MiMo Token Plan', type: 'openai', models: ['mimo-chat'], requiresApiKey: true, baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1' },
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
        <h2>${t('bootFatalTitle')}</h2>
        <p><strong>${e.message}</strong></p>
        <pre style="background:#fff;padding:10px;overflow:auto;font-size:11px;">${(e.stack || '').slice(0, 800)}</pre>
        <p style="color:#666;font-size:12px;">${t('bootFatalTail')}</p>
      </div>
    `
  }
}

boot()

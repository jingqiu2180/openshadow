// desktop/scripts/bridge-contract.cjs
//
// 桥接契约测试（确定性、无需 Electron 运行时）：
// 用桩 electron 拦截 require('electron')，真正 require 并执行真实的 desktop/preload.cjs，
// 捕获其 contextBridge.exposeInMainWorld 调用，断言：
//   1) 恰好 expose 一个全局 'shadow'（真实契约名）
//   2) 零个幽灵全局 'openshadow'（死 preload.js 曾暴露，已删除）
//   3) 'shadow' 对象上核心桥接方法均为函数
//
// 这能抓住我们 v0.4.5~v0.4.7 连踩的"幽灵全局"回归类（preload 暴露名与渲染层读取名不一致）。
// CI 中作为发版阻断步骤运行（npm run test:bridge）。

'use strict'

const path = require('path')
const Module = require('module')

/** @type {{name:string, value:any}[]} */
const exposed = []

const ipcRendererStub = {
  invoke: async () => undefined,
  send: () => {},
  on: () => {},
  removeListener: () => {},
}

const electronStub = {
  contextBridge: {
    exposeInMainWorld: (name, value) => exposed.push({ name, value }),
  },
  ipcRenderer: ipcRendererStub,
  shell: { openExternal: () => {} },
}

// 拦截 require('electron') -> 返回桩；其余模块正常加载
const origLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'electron') return electronStub
  // eslint-disable-next-line prefer-rest-params
  return origLoad.apply(this, arguments)
}

const preloadPath = path.resolve(__dirname, '..', 'preload.cjs')

try {
  require(preloadPath)
} catch (e) {
  console.error('[bridge-contract] 加载真实 preload.cjs 失败:', e)
  process.exit(1)
}

const names = exposed.map((e) => e.name)
const shadowEntries = exposed.filter((e) => e.name === 'shadow')
const openshadowEntries = exposed.filter((e) => e.name === 'openshadow')

let failed = false
function check(cond, msg) {
  if (cond) {
    console.log('  \u2713 ' + msg)
  } else {
    console.error('  \u2717 ' + msg)
    failed = true
  }
}

console.log('[bridge-contract] exposeInMainWorld 调用:', JSON.stringify(names))

check(shadowEntries.length === 1, "恰好 expose 一个全局 'shadow'")
check(openshadowEntries.length === 0, "零个幽灵全局 'openshadow'（死 preload.js 已删除）")

if (shadowEntries.length === 1) {
  const shadow = shadowEntries[0].value
  check(typeof shadow === 'object' && shadow !== null, "'shadow' 是对象")
  const requiredMethods = [
    'getServerPort',
    'getServerToken',
    'onServerReady',
    'onServerRestarted',
    'selectFolder',
    'selectFiles',
    'windowMinimize',
    'windowMaximize',
    'windowClose',
    'getAppVersion',
    'onboardingComplete',
    'getSplashInfo',
  ]
  for (const m of requiredMethods) {
    check(typeof shadow[m] === 'function', `'shadow.${m}' 是函数`)
  }
}

check(
  exposed.some((e) => e.name === '__REM_API__'),
  "保留 __REM_API__ 桥接（既有浏览器/截图能力）",
)

if (failed) {
  console.error('\n[bridge-contract] 失败 \u2717')
  process.exit(1)
}
console.log('\n[bridge-contract] 通过 \u2705')

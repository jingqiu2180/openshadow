// desktop/scripts/smoke-launch.cjs
//
// 真机拉起冒烟测试（真实 Electron 运行时）。
// ⚠️ 必须用 `electron` 二进制跑此脚本（npm run test:smoke → electron desktop/scripts/smoke-launch.cjs），
// 不能用 `node` —— 在纯 node 进程里 require('electron') 返回的是二进制**路径字符串**，
// app / BrowserWindow 会是 undefined，脚本会报 "Cannot read properties of undefined (reading 'whenReady')"。
//
// 用真实 Electron 加载一个空白页 + 真实的 desktop/preload.bundle.cjs，
// 在真实渲染进程里断言：
//   - window.shadow 真实存在（preload 在真实 Electron 上下文确实注入了契约全局）
//   - window.shadow.getServerPort() 可经真实 IPC 调用（本脚本注册了测试用 ipcMain handler）
//   - 不存在幽灵全局 window.openshadow
//
// 这是"真正拉起 app 的 preload"的最小真机验证（不拉整个 server / 不跑完整 UI，所以稳定）。
// CI 中在 Linux + xvfb 下运行（npm run test:smoke）。

'use strict'

const path = require('path')
const fs = require('fs')
const { app, BrowserWindow, ipcMain } = require('electron')

const PRELOAD = path.resolve(__dirname, '..', 'preload.bundle.cjs')
const TIMEOUT_MS = 30000

function fail(msg) {
  console.error('[smoke] ✗ ' + msg)
  try {
    app.exit(1)
  } catch {
    process.exit(1)
  }
}

if (!fs.existsSync(PRELOAD)) {
  fail('preload.bundle.cjs 不存在，请先运行 npm run electron:preload')
}

// Linux CI 由 xvfb 提供虚拟 display；root 用户必须 no-sandbox；
// disable-gpu / disable-dev-shm-usage 提升 headless runner 稳定性。
// 注意：不要用 'headless' 开关——它与 xvfb 的 display 会冲突，且会让 did-finish-load 行为异常。
try {
  app.commandLine.appendSwitch('no-sandbox')
  app.commandLine.appendSwitch('disable-gpu')
  app.commandLine.appendSwitch('disable-dev-shm-usage')
} catch {
  /* ignore */
}

// 注册一个最小测试用 IPC handler，让 preload 的 getServerPort() 能真正经 IPC 往返成功。
// （真实 app 里这个 handler 由主进程 server-manager 注册；此处仅验证通道与契约可用。）
ipcMain.handle('server:get-info', async () => ({ port: 3000, token: 'smoke-token' }))

const timer = setTimeout(() => fail(`超时：preload 未在 ${TIMEOUT_MS}ms 内就绪`), TIMEOUT_MS)

app
  .whenReady()
  .then(() => {
    const win = new BrowserWindow({
      width: 400,
      height: 300,
      show: false,
      webPreferences: {
        preload: PRELOAD,
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    win.webContents.once('crashed', () => fail('渲染进程崩溃'))
    win.webContents.once('did-finish-load', async () => {
      try {
        const result = await win.webContents.executeJavaScript(
          `(async () => {
            const hasShadow = typeof window.shadow === 'object' && window.shadow !== null;
            const hasGetPort = hasShadow && typeof window.shadow.getServerPort === 'function';
            let port = null;
            if (hasGetPort) {
              try {
                // 即便主进程未注册 handler，也用 race 兜底，避免 promise 永久 pending 卡死超时
                port = await Promise.race([
                  window.shadow.getServerPort(),
                  new Promise((_, rej) => setTimeout(() => rej(new Error('ipc-timeout')), 3000)),
                ]);
              } catch (e) { port = null; }
            }
            const noGhost = typeof window.openshadow === 'undefined';
            return { hasShadow, hasGetPort, port, noGhost };
          })()`,
        )
        clearTimeout(timer)
        console.log('[smoke] window.shadow 存在:', result.hasShadow)
        console.log(
          '[smoke] window.shadow.getServerPort 经真实 IPC 调用返回:',
          result.hasGetPort,
          '->',
          result.port,
        )
        console.log('[smoke] 无幽灵全局 window.openshadow:', result.noGhost)

        const ok = result.hasShadow && result.hasGetPort && result.noGhost && result.port === 3000
        if (ok) {
          console.log('[smoke] 通过 ✅')
          try {
            app.exit(0)
          } catch {
            process.exit(0)
          }
        } else {
          fail('window.shadow 契约不满足: ' + JSON.stringify(result))
        }
      } catch (e) {
        fail('执行检查失败: ' + (e && e.stack ? e.stack : String(e)))
      }
    })

    win.loadURL('data:text/html,<html><body>smoke</body></html>')
  })
  .catch((e) => fail('app 启动失败: ' + (e && e.stack ? e.stack : String(e))))

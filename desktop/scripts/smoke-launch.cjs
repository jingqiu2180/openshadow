// desktop/scripts/smoke-launch.cjs
//
// 真机拉起冒烟测试（真实 Electron，非桩）：
// 用真实 Electron 加载一个空白页 + 真实的 desktop/preload.bundle.cjs，
// 在真实渲染进程里断言：
//   - window.shadow 真实存在（preload 在真实 Electron 上下文确实注入了契约全局）
//   - window.shadow.getServerPort() 可经真实 IPC 调用（无 handler 时回落 3000）
//   - 不存在幽灵全局 window.openshadow
//
// 这是"真正拉起 app 的 preload"的最小真机验证（不拉整个 server / 不跑完整 UI，所以稳定）。
// CI 中在 Linux + xvfb 下运行（npm run test:smoke）。

'use strict'

const path = require('path')
const fs = require('fs')
const { app, BrowserWindow } = require('electron')

const PRELOAD = path.resolve(__dirname, '..', 'preload.bundle.cjs')
const TIMEOUT_MS = 30000

function fail(msg) {
  console.error('[smoke] \u2717 ' + msg)
  try {
    app.exit(1)
  } catch {
    process.exit(1)
  }
}

if (!fs.existsSync(PRELOAD)) {
  fail('preload.bundle.cjs 不存在，请先运行 npm run electron:preload')
}

// Linux CI 无显示，需要这些开关；Windows/macOS 本 job 不运行
try {
  app.commandLine.appendSwitch('no-sandbox')
  app.commandLine.appendSwitch('headless')
} catch {
  /* 某些版本不支持 headless 开关，忽略 */
}

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
            try { port = hasGetPort ? await window.shadow.getServerPort() : null; } catch { port = null; }
            const noGhost = typeof window.openshadow === 'undefined';
            return { hasShadow, hasGetPort, port, noGhost };
          })()`,
        )
        clearTimeout(timer)
        console.log('[smoke] window.shadow 存在:', result.hasShadow)
        console.log(
          '[smoke] window.shadow.getServerPort 可经 IPC 调用:',
          result.hasGetPort,
          '->',
          result.port,
        )
        console.log('[smoke] 无幽灵全局 window.openshadow:', result.noGhost)

        const ok = result.hasShadow && result.hasGetPort && result.noGhost
        if (ok) {
          console.log('[smoke] 通过 \u2705')
          try {
            app.exit(0)
          } catch {
            process.exit(0)
          }
        } else {
          fail('window.shadow 契约不满足')
        }
      } catch (e) {
        fail('执行检查失败: ' + (e && e.stack ? e.stack : String(e)))
      }
    })

    win.loadURL('data:text/html,<html><body>smoke</body></html>')
  })
  .catch((e) => fail('app 启动失败: ' + (e && e.stack ? e.stack : String(e))))

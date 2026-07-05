// Browser Agent Controller for openshadow
// Uses WebContentsView to provide a real embedded browser (not iframe/webview).
// Adapted from Lynn's browser-agent.cjs

const path = require('path')
const { BrowserWindow, WebContentsView, session: electronSession } = require('electron')
const { isAllowedBrowserUrl } = require('./browser-url-guard.cjs')

function createBrowserAgentController({
  isDev,
  viteDevUrl,
  preloadPath,
  getMainWindow,
}) {
  let browserViewerWindow = null
  let browserWebView = null
  const browserViews = new Map()
  let currentBrowserSession = null
  let commandSocket = null

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

  function getWindow() {
    return browserViewerWindow
  }

  function getWebView() {
    return browserWebView
  }

  function notifyViewerUrl(url) {
    if (browserViewerWindow && !browserViewerWindow.isDestroyed() && browserWebView) {
      browserViewerWindow.webContents.send('browser-update', {
        url,
        title: browserWebView.webContents.getTitle(),
        canGoBack: browserWebView.webContents.canGoBack(),
        canGoForward: browserWebView.webContents.canGoForward(),
      })
    }
  }

  function updateBrowserViewBounds() {
    if (!browserWebView || !browserViewerWindow || browserViewerWindow.isDestroyed()) return
    const [width, height] = browserViewerWindow.getContentSize()
    const titlebarHeight = 44
    const mx = 8
    const mt = 4
    const mb = 8
    const bounds = {
      x: mx,
      y: titlebarHeight + mt,
      width: Math.max(0, width - mx * 2),
      height: Math.max(0, height - titlebarHeight - mt - mb),
    }
    browserWebView.setBounds(bounds)
  }

  function createWindow(opts = {}) {
    const shouldShow = opts.show !== false
    if (browserViewerWindow && !browserViewerWindow.isDestroyed()) {
      if (shouldShow) {
        browserViewerWindow.show()
        browserViewerWindow.focus()
        updateBrowserViewBounds()
        if (browserWebView) {
          delay(50).then(() => {
            if (browserWebView) browserWebView.webContents.focus()
          })
        }
      }
      return
    }

    browserViewerWindow = new BrowserWindow({
      width: 1200,
      height: 1080,
      minWidth: 480,
      minHeight: 360,
      title: 'OpenShadow Browser',
      frame: false,
      backgroundColor: '#F8F5ED',
      hasShadow: true,
      show: shouldShow,
      acceptFirstMouse: true,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    })

    // Load browser viewer page
    if (isDev) {
      browserViewerWindow.loadURL(viteDevUrl + '/browser-viewer').catch(err => {
        console.error('[browser] failed to load browser-viewer:', err.message)
      })
    } else {
      const exePath = require('electron').app.getAppPath()
      const viewerHtml = path.join(exePath, 'desktop', 'dist-renderer', 'browser-viewer.html')
      browserViewerWindow.loadFile(viewerHtml).catch(err => {
        console.error('[browser] failed to load browser-viewer.html:', err.message)
      })
    }

    browserViewerWindow.webContents.on('did-finish-load', () => {
      if (browserWebView && browserViewerWindow && !browserViewerWindow.isDestroyed()) {
        try { browserViewerWindow.contentView.removeChildView(browserWebView) } catch {}
        browserViewerWindow.contentView.addChildView(browserWebView)
        updateBrowserViewBounds()
        const url = browserWebView.webContents.getURL()
        if (url) notifyViewerUrl(url)
      }
    })

    browserViewerWindow.on('resize', () => updateBrowserViewBounds())
    browserViewerWindow.on('show', () => updateBrowserViewBounds())
    browserViewerWindow.on('close', (event) => {
      // Hide instead of close
      if (browserViewerWindow && !browserViewerWindow.isDestroyed()) {
        event.preventDefault()
        browserViewerWindow.hide()
      }
    })
    browserViewerWindow.on('closed', () => {
      browserViewerWindow = null
    })
  }

  function show() {
    createWindow()
  }

  function hideWindow() {
    if (browserViewerWindow && !browserViewerWindow.isDestroyed()) browserViewerWindow.hide()
  }

  function closeViewer() {
    if (browserViewerWindow && !browserViewerWindow.isDestroyed()) browserViewerWindow.close()
  }

  function goBack() {
    if (browserWebView) browserWebView.webContents.goBack()
  }

  function goForward() {
    if (browserWebView) browserWebView.webContents.goForward()
  }

  function reload() {
    if (browserWebView) browserWebView.webContents.reload()
  }

  function emergencyStop() {
    if (browserWebView) {
      if (browserViewerWindow && !browserViewerWindow.isDestroyed()) {
        try { browserViewerWindow.contentView.removeChildView(browserWebView) } catch {}
      }
      browserWebView.webContents.close()
      if (currentBrowserSession) browserViews.delete(currentBrowserSession)
      browserWebView = null
      currentBrowserSession = null
    }
    if (browserViewerWindow && !browserViewerWindow.isDestroyed()) {
      browserViewerWindow.webContents.send('browser-update', { running: false })
    }
  }

  // Handle browser commands (called from IPC or WebSocket)
  async function handleCommand(cmd, params = {}) {
    switch (cmd) {
      case 'launch': {
        if (browserWebView) return { ok: true, reused: true }
        const ses = electronSession.fromPartition('persist:openshadow-browser')
        const view = new WebContentsView({
          webPreferences: {
            session: ses,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        })

        view.webContents.on('did-navigate', (_event, url) => {
          if (isAllowedBrowserUrl(url)) {
            notifyViewerUrl(url)
          } else {
            console.warn('[browser] blocked navigation to:', url)
            view.webContents.loadURL('about:blank')
          }
        })
        view.webContents.on('did-navigate-in-page', (_event, url) => notifyViewerUrl(url))
        view.webContents.setWindowOpenHandler(({ url }) => {
          if (isAllowedBrowserUrl(url)) view.webContents.loadURL(url)
          return { action: 'deny' }
        })
        view.setBorderRadius(10)

        browserWebView = view
        currentBrowserSession = params.sessionPath || null
        if (currentBrowserSession) browserViews.set(currentBrowserSession, view)

        createWindow({ show: false })
        if (browserViewerWindow && !browserViewerWindow.isDestroyed()) {
          try { browserViewerWindow.contentView.removeChildView(browserWebView) } catch {}
          browserViewerWindow.contentView.addChildView(browserWebView)
          updateBrowserViewBounds()
          delay(300).then(() => {
            if (browserWebView) browserWebView.webContents.focus()
          })
        }

        // Navigate to initial URL if provided
        if (params.url && isAllowedBrowserUrl(params.url)) {
          view.webContents.loadURL(params.url)
        }

        return { ok: true }
      }

      case 'close': {
        emergencyStop()
        return { ok: true }
      }

      case 'navigate': {
        if (!browserWebView) return { ok: false, error: 'no browser running' }
        if (params.url && isAllowedBrowserUrl(params.url)) {
          browserWebView.webContents.loadURL(params.url)
          return { ok: true }
        }
        return { ok: false, error: 'invalid or blocked URL' }
      }

      case 'back': {
        if (browserWebView) browserWebView.webContents.goBack()
        return { ok: true }
      }

      case 'forward': {
        if (browserWebView) browserWebView.webContents.goForward()
        return { ok: true }
      }

      case 'reload': {
        if (browserWebView) browserWebView.webContents.reload()
        return { ok: true }
      }

      case 'screenshot': {
        if (!browserWebView) return { ok: false, error: 'no browser running' }
        try {
          const image = browserWebView.webContents.capturePage()
          const size = image.getSize()
          const base64 = image.toPNG().toString('base64')
          return { ok: true, base64, width: size.width, height: size.height }
        } catch (err) {
          return { ok: false, error: err.message }
        }
      }

      case 'get-html': {
        if (!browserWebView) return { ok: false, error: 'no browser running' }
        return new Promise((resolve) => {
          browserWebView.webContents.executeJavaScript('document.documentElement.outerHTML').then(html => {
            resolve({ ok: true, html })
          }).catch(err => resolve({ ok: false, error: err.message }))
        })
      }

      case 'click': {
        if (!browserWebView || !params.selector) return { ok: false, error: 'no browser or no selector' }
        const script = `
          (function() {
            const el = document.querySelector(${JSON.stringify(params.selector)});
            if (el) { el.click(); return true; }
            return false;
          })()
        `
        return browserWebView.webContents.executeJavaScript(script).then(result => ({
          ok: true,
          clicked: result
        })).catch(err => ({ ok: false, error: err.message }))
      }

      case 'type': {
        if (!browserWebView || !params.selector || !params.text) return { ok: false, error: 'missing params' }
        const script = `
          (function() {
            const el = document.querySelector(${JSON.stringify(params.selector)});
            if (el) { el.value = ${JSON.stringify(params.text)}; return true; }
            return false;
          })()
        `
        return browserWebView.webContents.executeJavaScript(script).then(result => ({
          ok: true,
          typed: result
        })).catch(err => ({ ok: false, error: err.message }))
      }

      default:
        return { ok: false, error: 'unknown command: ' + cmd }
    }
  }

  // Setup WebSocket connection to server for browser control
  function setupCommands(serverPort, serverToken) {
    if (!serverPort || !serverToken) {
      console.log('[browser] no server port/token, skipping WebSocket setup')
      return
    }

    try {
      const WebSocket = require('ws')
      const url = `ws://127.0.0.1:${serverPort}/internal/browser`
      const protocols = serverToken ? ['openshadow-browser', `token.${serverToken}`] : ['openshadow-browser']

      function connect() {
        commandSocket = new WebSocket(url, protocols)
        commandSocket.on('open', () => {
          console.log('[browser] WebSocket connected to server')
        })
        commandSocket.on('message', async (data) => {
          let msg
          try { msg = JSON.parse(data) } catch { return }
          if (msg?.type !== 'browser-cmd') return
          const { id, cmd, params } = msg
          try {
            const result = await handleCommand(cmd, params || {})
            if (commandSocket && commandSocket.readyState === 1) {
              commandSocket.send(JSON.stringify({ type: 'browser-result', id, result }))
            }
          } catch (err) {
            if (commandSocket && commandSocket.readyState === 1) {
              commandSocket.send(JSON.stringify({ type: 'browser-result', id, error: err.message }))
            }
          }
        })
        commandSocket.on('close', () => {
          setTimeout(connect, 2000)
        })
        commandSocket.on('error', () => {})
      }

      connect()
    } catch (err) {
      console.warn('[browser] failed to setup WebSocket:', err.message)
    }
  }

  function shutdown() {
    for (const [, view] of browserViews) {
      try { view.webContents.close() } catch {}
    }
    browserViews.clear()
    browserWebView = null
    currentBrowserSession = null
    try { commandSocket?.close?.() } catch {}
    commandSocket = null
  }

  // Register IPC handlers for renderer-controlled browser
  function registerIpc(wrapIpcHandler) {
    wrapIpcHandler('browser:launch', async (_event, params) => {
      return await handleCommand('launch', params || {})
    })

    wrapIpcHandler('browser:navigate', async (_event, url) => {
      return await handleCommand('navigate', { url })
    })

    wrapIpcHandler('browser:close', async () => {
      return await handleCommand('close')
    })

    wrapIpcHandler('browser:back', async () => {
      return await handleCommand('back')
    })

    wrapIpcHandler('browser:forward', async () => {
      return await handleCommand('forward')
    })

    wrapIpcHandler('browser:reload', async () => {
      return await handleCommand('reload')
    })

    wrapIpcHandler('browser:screenshot', async () => {
      return await handleCommand('screenshot')
    })

    wrapIpcHandler('browser:show', () => {
      show()
      return { ok: true }
    })

    wrapIpcHandler('browser:hide', () => {
      hideWindow()
      return { ok: true }
    })
  }

  return {
    getWindow,
    getWebView,
    show,
    hideWindow,
    closeViewer,
    goBack,
    goForward,
    reload,
    emergencyStop,
    handleCommand,
    setupCommands,
    shutdown,
    registerIpc,
  }
}

module.exports = { createBrowserAgentController }

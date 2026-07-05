// Editor Window Controller for openshadow
// Provides a dedicated window for editing files, with path sandbox enforcement.
// Adapted from Lynn's editor-window-controller.cjs

const path = require('path')
const { BrowserWindow } = require('electron')

function createEditorWindowController({
  wrapIpcHandler,
  isDev,
  viteDevUrl,
  preloadPath,
  getMainWindow,
  canWritePath,
  grantWebContentsAccess,
}) {
  let editorWindow = null
  let editorFileData = null

  function getWindow() {
    return editorWindow
  }

  function hide() {
    if (editorWindow && !editorWindow.isDestroyed()) editorWindow.hide()
  }

  function destroy() {
    if (editorWindow && !editorWindow.isDestroyed()) editorWindow.destroy()
    editorWindow = null
    editorFileData = null
  }

  function notifyDocked(data = editorFileData) {
    const mainWindow = getMainWindow()
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.send('editor-detached', false)
    if (data) mainWindow.webContents.send('editor-dock-file', data)
  }

  function register() {
    wrapIpcHandler('open-editor-window', (event, data) => {
      if (!data || !data.filePath) return { ok: false, error: 'no file path' }
      if (!canWritePath || !canWritePath(event.sender, data.filePath)) {
        return { ok: false, error: 'access denied: ' + data.filePath }
      }

      editorFileData = data

      if (editorWindow && !editorWindow.isDestroyed()) {
        // Reuse existing window
        if (grantWebContentsAccess) grantWebContentsAccess(editorWindow, data.filePath, 'readwrite')
        editorWindow.show()
        editorWindow.focus()
        editorWindow.webContents.send('editor-load', data)
        return { ok: true, reused: true }
      }

      // Create new editor window
      editorWindow = new BrowserWindow({
        width: 720,
        height: 800,
        minWidth: 400,
        minHeight: 300,
        title: data.title || 'OpenShadow Editor',
        frame: false,
        backgroundColor: '#F8F5ED',
        hasShadow: true,
        show: true,
        acceptFirstMouse: true,
        webPreferences: {
          preload: preloadPath,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false,
        },
      })

      if (grantWebContentsAccess) grantWebContentsAccess(editorWindow, data.filePath, 'readwrite')

      // Load editor page
      if (isDev) {
        editorWindow.loadURL(viteDevUrl + '/editor').catch(err => {
          console.error('[editor] failed to load editor page:', err.message)
        })
      } else {
        const exePath = require('electron').app.getAppPath()
        const editorHtml = path.join(exePath, 'desktop', 'dist-renderer', 'editor.html')
        editorWindow.loadFile(editorHtml).catch(err => {
          // Fallback: try loading index with editor route
          const indexHtml = path.join(exePath, 'desktop', 'dist-renderer', 'index.html')
          editorWindow.loadFile(indexHtml).catch(e => {
            console.error('[editor] failed to load editor page:', e.message)
          })
        })
      }

      editorWindow.webContents.on('did-finish-load', () => {
        if (editorFileData && editorWindow && !editorWindow.isDestroyed()) {
          editorWindow.webContents.send('editor-load', editorFileData)
        }
      })

      editorWindow.on('close', (event) => {
        // Hide instead of close (keep in background)
        if (editorWindow && !editorWindow.isDestroyed()) {
          event.preventDefault()
          editorWindow.hide()
          notifyDocked(null)
        }
      })

      editorWindow.on('closed', () => {
        editorWindow = null
        editorFileData = null
      })

      return { ok: true, reused: false }
    })

    wrapIpcHandler('editor-dock', () => {
      notifyDocked()
      hide()
      return { ok: true }
    })

    wrapIpcHandler('editor-close', () => {
      notifyDocked(null)
      hide()
      return { ok: true }
    })
  }

  return { register, getWindow, hide, destroy }
}

module.exports = { createEditorWindowController }

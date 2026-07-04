// desktop/settings-window-controller.cjs
// OpenShadow Settings Window Controller
// 管理设置窗口的创建、显示、隐藏

const { BrowserWindow } = require('electron')
const { join } = require('path')
const { existsSync } = require('fs')

let settingsWindow = null

function createSettingsWindow({ mainWindow, preloadPath, iconPath, isDev, viteDevUrl }) {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    return settingsWindow
  }

  settingsWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 700,
    minHeight: 500,
    title: 'OpenShadow 设置',
    icon: iconPath,
    show: false,
    minimizable: true,
    maximizable: true,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
    },
    parent: mainWindow,
    modal: false,
  })

  settingsWindow.once('ready-to-show', () => {
    if (settingsWindow) {
      settingsWindow.show()
    }
  })

  // 加载设置页面
  if (isDev) {
    settingsWindow.loadURL(viteDevUrl + '/settings')
  } else {
    const htmlPath = join(process.cwd(), 'desktop', 'dist-renderer', 'index.html')
    settingsWindow.loadFile(htmlPath, { hash: 'settings' })
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })

  return settingsWindow
}

function getSettingsWindow() {
  return (settingsWindow && !settingsWindow.isDestroyed()) ? settingsWindow : null
}

function closeSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close()
    settingsWindow = null
  }
}

module.exports = {
  createSettingsWindow,
  getSettingsWindow,
  closeSettingsWindow,
}

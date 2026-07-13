// desktop/settings-window-controller.cjs
// OpenShadow Settings Window Controller
// 管理设置窗口的创建、显示、隐藏

const { BrowserWindow, app } = require('electron')
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
    settingsWindow.loadURL(viteDevUrl + '/settings.html')
  } else {
    // 生产环境：dist-renderer 位于 app.asar 内，必须用 app.getAppPath() 定位，
    // 不能用 process.cwd()（那是安装根目录，路径不存在 → 白屏）。
    const htmlPath = join(app.getAppPath(), 'desktop', 'dist-renderer', 'settings.html')
    settingsWindow.loadFile(htmlPath)
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

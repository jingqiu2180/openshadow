// tests/__mocks__/electron.cjs
// Mock electron 模块用于 IPC handler 单元测试
// 在 vitest.config.ts 里通过 resolve.alias 注入

// IPC handler 注册表（每个测试文件 import 时重置）
const ipcHandlers = new Map()
const ipcOnHandlers = new Map()

function resetMockState() {
  ipcHandlers.clear()
  ipcOnHandlers.clear()
}

function getIpcHandlers() {
  return ipcHandlers
}

function getIpcOnHandlers() {
  return ipcOnHandlers
}

// Default mock impls
let showOpenDialogImpl = async () => ({ canceled: true, filePaths: [] })

const electron = {
  app: {
    isPackaged: false,
    setAppUserModelId: () => {},
    getAppPath: () => '/fake/app/path',
    quit: () => {},
    whenReady: () => Promise.resolve(),
    on: () => {},
  },
  BrowserWindow: function BrowserWindow() {
    return {
      webContents: { send: () => {}, openDevTools: () => {}, capturePage: async () => ({ getSize: () => ({ width: 0, height: 0 }), toPNG: () => Buffer.from('') }) },
      loadURL: () => Promise.resolve(),
      loadFile: () => Promise.resolve(),
      on: () => {},
      once: () => {},
      isMaximized: () => false,
      isDestroyed: () => false,
      show: () => {},
      close: () => {},
      getAllWindows: () => [],
      fromWebContents: () => null,
    }
  },
  desktopCapturer: {
    getSources: async () => [],
  },
  dialog: {
    showOpenDialog: (...args) => showOpenDialogImpl(...args),
    showMessageBoxSync: () => 0,
  },
  ipcMain: {
    handle: (channel, fn) => { ipcHandlers.set(channel, fn) },
    on: (channel, fn) => { ipcOnHandlers.set(channel, fn) },
  },
  Menu: {
    setApplicationMenu: () => {},
  },
}

module.exports = electron
module.exports.__resetMockState = resetMockState
module.exports.__getIpcHandlers = getIpcHandlers
module.exports.__getIpcOnHandlers = getIpcOnHandlers
module.exports.__setShowOpenDialogImpl = (fn) => { showOpenDialogImpl = fn }

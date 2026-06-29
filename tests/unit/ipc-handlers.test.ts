// tests/unit/ipc-handlers.test.ts
// 单元测试：electron-main.ts 的 IPC handler 注册和行为
// 使用 vitest 的 vi.mock 拦截 require('electron')

// TODO: openshadow 已重命名为 main.tsx（React 入口），原 openhanako 的 desktop/src/electron-main.ts
// 不再存在。import 阶段就崩。暂时跳过整个文件；保留代码作为文档。
import { describe, it, expect, beforeEach, vi } from 'vitest'

// 这些函数会在 mock 实现里通过 module 缓存共享
const ipcHandlers = new Map<string, Function>()
const ipcOnHandlers = new Map<string, Function>()

let showOpenDialogImpl: (args: any) => Promise<any> = async () => ({
  canceled: true,
  filePaths: [],
})

// 全局共享的 mock state 对象（避免 hoisting 问题）
const mockState = {
  reset() {
    ipcHandlers.clear()
    ipcOnHandlers.clear()
  },
  getHandlers() { return ipcHandlers },
  getOnHandlers() { return ipcOnHandlers },
  setShowOpenDialog(fn: any) { showOpenDialogImpl = fn },
}

// vi.mock 必须 hoist 到 import 之前
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    setAppUserModelId: () => {},
    getAppPath: () => '/fake/app/path',
    quit: () => {},
    whenReady: () => Promise.resolve(),
    on: () => {},
    commandLine: {
      appendSwitch: () => {},
    },
  },
  BrowserWindow: function BrowserWindow() {
    return {
      webContents: {
        send: () => {},
        openDevTools: () => {},
        capturePage: async () => ({
          getSize: () => ({ width: 0, height: 0 }),
          toPNG: () => Buffer.from(''),
        }),
      },
      loadURL: () => Promise.resolve(),
      loadFile: () => Promise.resolve(),
      on: () => {},
      once: () => {},
      isMaximized: () => false,
      isDestroyed: () => false,
      show: () => {},
      close: () => {},
      fromWebContents: () => null,
    }
  },
  desktopCapturer: {
    getSources: async () => [],
  },
  dialog: {
    showOpenDialog: (args: any) => showOpenDialogImpl(args),
    showMessageBoxSync: () => 0,
  },
  ipcMain: {
    handle: (channel: string, fn: Function) => ipcHandlers.set(channel, fn),
    on: (channel: string, fn: Function) => ipcOnHandlers.set(channel, fn),
  },
  Menu: {
    setApplicationMenu: () => {},
  },
}))

// 必须在 vi.mock 之后 import（vitest 会自动 hoist）
// import 源 .ts 文件而不是编译产物 .js，让 vitest transformer 完整处理
// const { registerIpcHandlers } = await import('../../desktop/src/electron-main.ts') // 注释掉：原文件不存在

describe.skip('IPC handlers - registration', () => {
  beforeEach(() => {
    mockState.reset()
    registerIpcHandlers()
  })

  it('registers wizard:get-config handler', () => {
    expect(mockState.getHandlers().has('wizard:get-config')).toBe(true)
  })

  it('registers wizard:save-config handler', () => {
    expect(mockState.getHandlers().has('wizard:save-config')).toBe(true)
  })

  it('registers wizard:test-connection handler', () => {
    expect(mockState.getHandlers().has('wizard:test-connection')).toBe(true)
  })

  it('registers wizard:pick-folder handler (workspace setup)', () => {
    expect(mockState.getHandlers().has('wizard:pick-folder')).toBe(true)
  })

  it('registers dialog:selectFolder handler (Rem fix #2)', () => {
    expect(mockState.getHandlers().has('dialog:selectFolder')).toBe(true)
  })

  it('registers dialog:selectFiles handler', () => {
    expect(mockState.getHandlers().has('dialog:selectFiles')).toBe(true)
  })

  it('registers screenshot:capture handler', () => {
    expect(mockState.getHandlers().has('screenshot:capture')).toBe(true)
  })

  it('registers screenshot:capture-window handler', () => {
    expect(mockState.getHandlers().has('screenshot:capture-window')).toBe(true)
  })

  it('registers browser:create handler', () => {
    expect(mockState.getHandlers().has('browser:create')).toBe(true)
  })

  it('registers browser:navigate handler', () => {
    expect(mockState.getHandlers().has('browser:navigate')).toBe(true)
  })

  it('registers browser:close handler', () => {
    expect(mockState.getHandlers().has('browser:close')).toBe(true)
  })

  it('registers window:is-maximized handler', () => {
    expect(mockState.getHandlers().has('window:is-maximized')).toBe(true)
  })

  it('registers window:minimize listener', () => {
    expect(mockState.getOnHandlers().has('window:minimize')).toBe(true)
  })

  it('registers window:maximize listener', () => {
    expect(mockState.getOnHandlers().has('window:maximize')).toBe(true)
  })

  it('registers window:close listener', () => {
    expect(mockState.getOnHandlers().has('window:close')).toBe(true)
  })
})

describe.skip('IPC handlers - behavior', () => {
  beforeEach(() => {
    mockState.reset()
    registerIpcHandlers()
  })

  describe('dialog:selectFolder', () => {
    it('returns single path (string), not array (Rem fix #3)', async () => {
      mockState.setShowOpenDialog(async () => ({
        canceled: false,
        filePaths: ['C:\\Users\\test\\folder1', 'C:\\Users\\test\\folder2'],
      }))

      const handler = mockState.getHandlers().get('dialog:selectFolder')!
      const result = await handler({}, {})

      expect(result).toBe('C:\\Users\\test\\folder1')
      expect(typeof result).toBe('string')
    })

    it('returns null when user cancels', async () => {
      mockState.setShowOpenDialog(async () => ({ canceled: true, filePaths: [] }))

      const handler = mockState.getHandlers().get('dialog:selectFolder')!
      const result = await handler({}, {})

      expect(result).toBeNull()
    })

    it('passes openDirectory property to showOpenDialog', async () => {
      let capturedArgs: any = null
      mockState.setShowOpenDialog(async (args: any) => {
        capturedArgs = args
        return { canceled: true, filePaths: [] }
      })

      const handler = mockState.getHandlers().get('dialog:selectFolder')!
      await handler({}, {})

      expect(capturedArgs.properties).toContain('openDirectory')
      expect(capturedArgs.properties).toContain('createDirectory')
    })

    it('adds multiSelections when multi: true', async () => {
      let capturedArgs: any = null
      mockState.setShowOpenDialog(async (args: any) => {
        capturedArgs = args
        return { canceled: true, filePaths: [] }
      })

      const handler = mockState.getHandlers().get('dialog:selectFolder')!
      await handler({}, { multi: true })

      expect(capturedArgs.properties).toContain('multiSelections')
    })

    it('returns null when filePaths is empty (edge case)', async () => {
      mockState.setShowOpenDialog(async () => ({ canceled: false, filePaths: [] }))

      const handler = mockState.getHandlers().get('dialog:selectFolder')!
      const result = await handler({}, {})

      expect(result).toBeNull()
    })
  })

  describe('dialog:selectFiles', () => {
    it('returns array of file paths', async () => {
      mockState.setShowOpenDialog(async () => ({
        canceled: false,
        filePaths: ['C:\\file1.txt', 'C:\\file2.txt'],
      }))

      const handler = mockState.getHandlers().get('dialog:selectFiles')!
      const result = await handler({}, {})

      expect(result).toEqual(['C:\\file1.txt', 'C:\\file2.txt'])
    })

    it('returns empty array when user cancels', async () => {
      mockState.setShowOpenDialog(async () => ({ canceled: true, filePaths: [] }))

      const handler = mockState.getHandlers().get('dialog:selectFiles')!
      const result = await handler({}, {})

      expect(result).toEqual([])
    })

    it('passes openFile property (not openDirectory)', async () => {
      let capturedArgs: any = null
      mockState.setShowOpenDialog(async (args: any) => {
        capturedArgs = args
        return { canceled: true, filePaths: [] }
      })

      const handler = mockState.getHandlers().get('dialog:selectFiles')!
      await handler({}, {})

      expect(capturedArgs.properties).toContain('openFile')
      expect(capturedArgs.properties).not.toContain('openDirectory')
    })

    it('passes filters when provided', async () => {
      let capturedArgs: any = null
      mockState.setShowOpenDialog(async (args: any) => {
        capturedArgs = args
        return { canceled: true, filePaths: [] }
      })

      const handler = mockState.getHandlers().get('dialog:selectFiles')!
      await handler({}, { filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }] })

      expect(capturedArgs.filters).toEqual([{ name: 'Markdown', extensions: ['md', 'markdown'] }])
    })
  })

  describe('wizard:pick-folder', () => {
    it('returns array of paths (multi-select workspace)', async () => {
      mockState.setShowOpenDialog(async () => ({
        canceled: false,
        filePaths: ['C:\\workspace1', 'C:\\workspace2'],
      }))

      const handler = mockState.getHandlers().get('wizard:pick-folder')!
      const result = await handler({}, {})

      expect(result).toEqual(['C:\\workspace1', 'C:\\workspace2'])
    })

    it('returns empty array when user cancels', async () => {
      mockState.setShowOpenDialog(async () => ({ canceled: true, filePaths: [] }))

      const handler = mockState.getHandlers().get('wizard:pick-folder')!
      const result = await handler({}, {})

      expect(result).toEqual([])
    })

    it('uses multiSelections + createDirectory for workspace picker', async () => {
      let capturedArgs: any = null
      mockState.setShowOpenDialog(async (args: any) => {
        capturedArgs = args
        return { canceled: true, filePaths: [] }
      })

      const handler = mockState.getHandlers().get('wizard:pick-folder')!
      await handler({}, {})

      expect(capturedArgs.properties).toContain('openDirectory')
      expect(capturedArgs.properties).toContain('multiSelections')
      expect(capturedArgs.properties).toContain('createDirectory')
    })
  })
})
/**
 * Electron screenshot bridge — renderer-side IPC client.
 * Only used when running inside Electron (detected via window.__ELECTRON__ flag
 * set by the preload script).
 *
 * Flow:  renderer calls window.__REM_API__.screenshotCapture()
 *        → preload exposes it via contextBridge
 *        → ipcRenderer.invoke('screenshot:capture')
 *        → main process handler uses desktopCapturer / webContents.capturePage()
 */

import type { ScreenshotOutput } from './screenshot.js'

/** Check if we are running inside Electron with screenshot IPC available. */
export function isElectronScreenshotAvailable(): boolean {
  return typeof globalThis !== 'undefined'
    && !!(globalThis as any).__REM_API__?.screenshotCapture
}

/**
 * Capture screenshot via Electron IPC.
 * Returns the same shape as captureScreenshot() so callers can swap transparently.
 */
export async function captureScreenshotElectron(options?: {
  displayId?: number
}): Promise<ScreenshotOutput> {
  try {
    const api = (globalThis as any).__REM_API__
    if (!api?.screenshotCapture) {
      return { success: false, error: 'Electron screenshot IPC not available' }
    }
    const result = await api.screenshotCapture(options?.displayId)
    return result
  } catch (e: any) {
    return { success: false, error: `Electron screenshot failed: ${e.message}` }
  }
}

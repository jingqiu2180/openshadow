export interface ScreenshotResult {
  success: true
  path: string
  width: number
  height: number
}

export type ScreenshotError = { success: false; error: string }
export type ScreenshotOutput = ScreenshotResult | ScreenshotError

export async function captureScreenshot(_options: {
  filename?: string
  directory?: string
}): Promise<ScreenshotOutput> {
  return { success: false, error: 'Screenshot only in Electron' }
}

export async function captureScreenNative(): Promise<ScreenshotOutput> {
  const platform = process.platform
  const filename = `screenshot-${Date.now()}.png`

  try {
    if (platform === 'darwin') {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)
      await execAsync(`screencapture -x /tmp/${filename}`)
      return { success: true, path: `/tmp/${filename}`, width: 0, height: 0 }
    } else if (platform === 'linux') {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)
      try {
        await execAsync(`gnome-screenshot -f /tmp/${filename}`)
      } catch {
        await execAsync(`scrot /tmp/${filename}`)
      }
      return { success: true, path: `/tmp/${filename}`, width: 0, height: 0 }
    }
    return { success: false, error: 'Not supported on this platform' }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export function createScreenshotTools() {
  return { screenshot: captureScreenshot, screenshot_native: captureScreenNative }
}
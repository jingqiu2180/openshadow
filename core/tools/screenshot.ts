/**
 * Screenshot tool - cross-platform screen capture with base64 output.
 * Works on macOS (screencapture), Windows (PowerShell), Linux (gnome-screenshot/scrot/grim).
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const execAsync = promisify(execFile)

export interface ScreenshotResult {
  success: true
  base64: string
  path: string
  width: number
  height: number
  platform: string
}

export type ScreenshotError = { success: false; error: string }
export type ScreenshotOutput = ScreenshotResult | ScreenshotError

/**
 * Capture screenshot on macOS / Windows / Linux.
 * Returns base64 PNG image.
 */
export async function captureScreenshot(options: {
  filename?: string
  directory?: string
} = {}): Promise<ScreenshotOutput> {
  const platform = process.platform
  const filename = options.filename ?? `screenshot-${Date.now()}.png`
  const directory = options.directory ?? tmpdir()
  const filepath = join(directory, filename)

  mkdirSync(directory, { recursive: true })

  try {
    if (platform === 'darwin') {
      await execAsync('screencapture', ['-x', '-t', 'png', filepath])
    } else if (platform === 'linux') {
      try {
        await execAsync('gnome-screenshot', ['-f', filepath])
      } catch (e1: any) {
        try {
          await execAsync('scrot', [filepath])
        } catch (e2: any) {
          try {
            await execAsync('grim', [filepath])
          } catch (e3: any) {
            return {
              success: false,
              error: `No screenshot tool found on Linux. Install one of: gnome-screenshot, scrot (sudo apt install scrot), or grim (sudo apt install grim). Error: ${e3.message}`,
            }
          }
        }
      }
    } else if (platform === 'win32') {
      const safePath = filepath.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      const ps = `
Add-Type -AssemblyName System.Drawing
$bitmap = [System.Drawing.Bitmap]::new([System.Drawing.Screen]::PrimaryScreen)
$bitmap.Save("${safePath}", [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap.Dispose()
Write-Output "ok"
`
      const psPath = join(tmpdir(), `screenshot-${Date.now()}.ps1`)
      writeFileSync(psPath, ps, 'utf-8')
      try {
        await execAsync('powershell', ['-ExecutionPolicy', 'Bypass', '-File', psPath])
      } finally {
        try { unlinkSync(psPath) } catch {}
      }
    } else {
      return {
        success: false,
        error: `Screenshot not supported on ${platform}. On Windows use browser_screenshot, on macOS use screencapture, on Linux install gnome-screenshot or scrot.`,
      }
    }

    if (!existsSync(filepath)) {
      return { success: false, error: 'Screenshot file was not created. Check if screenshot tool is installed.' }
    }

    const base64 = readFileSync(filepath).toString('base64')
    return { success: true, base64, path: filepath, width: 0, height: 0, platform }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}
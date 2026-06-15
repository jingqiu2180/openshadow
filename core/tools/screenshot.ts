/**
 * Screenshot tool - cross-platform screen capture with base64 output.
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
      } catch {
        try {
          await execAsync('scrot', [filepath])
        } catch {
          await execAsync('grim', [filepath])
        }
      }
    } else if (platform === 'win32') {
      const ps = `
Add-Type -AssemblyName System.Drawing
$bitmap = [System.Drawing.Bitmap]::new([System.Drawing.Screen]::PrimaryScreen)
$bitmap.Save("${filepath.replace(/\\/g, '\\\\')}", [System.Drawing.Imaging.ImageFormat]::Png)
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
      return { success: false, error: `Unsupported platform: ${platform}` }
    }

    if (!existsSync(filepath)) {
      return { success: false, error: 'Screenshot file not created' }
    }

    const base64 = readFileSync(filepath).toString('base64')
    return { success: true, base64, path: filepath, width: 0, height: 0, platform }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}
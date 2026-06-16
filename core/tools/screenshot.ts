/**
 * Screenshot tool - cross-platform screen capture with base64 output.
 *
 * Two modes:
 * 1. **Electron mode** (preferred): Uses desktopCapturer via IPC when running
 *    inside Electron. No temp files, no external tools, gets real dimensions.
 * 2. **CLI / Server mode** (fallback): Uses system commands —
 *    macOS (screencapture), Windows (PowerShell), Linux (gnome-screenshot/scrot/grim).
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

// ─── Electron IPC bridge detection ────────────────────────────────────

/**
 * Check if Electron screenshot IPC is available.
 * The preload script sets window.__REM_API__.screenshotCapture when running
 * inside Electron. In CLI/server mode this won't exist.
 */
function isElectronScreenshotAvailable(): boolean {
  return typeof globalThis !== 'undefined'
    && !!(globalThis as any).__REM_API__?.screenshotCapture
}

/**
 * Capture screenshot via Electron IPC (desktopCapturer).
 * Called from renderer process; the main process handles the actual capture.
 */
async function captureScreenshotElectron(displayId?: number): Promise<ScreenshotOutput> {
  try {
    const api = (globalThis as any).__REM_API__
    const result = await api.screenshotCapture(displayId)
    return result
  } catch (e: any) {
    return { success: false, error: `Electron screenshot failed: ${e.message}` }
  }
}

// ─── System-command fallback (CLI / server mode) ──────────────────────

async function captureScreenshotSystem(options: {
  filename?: string
  directory?: string
}): Promise<ScreenshotOutput> {
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

// ─── Unified entry point ──────────────────────────────────────────────

/**
 * Capture screenshot — prefers Electron native (desktopCapturer) when
 * available, falls back to system commands in CLI/server mode.
 *
 * In Electron mode: no temp file written, returns real dimensions.
 * In CLI mode: writes temp PNG, reads back to base64, dimensions = 0.
 */
export async function captureScreenshot(options: {
  filename?: string
  directory?: string
  displayId?: number
} = {}): Promise<ScreenshotOutput> {
  // Electron path: fast, no temp files, real dimensions
  if (isElectronScreenshotAvailable()) {
    const result = await captureScreenshotElectron(options.displayId)
    if (result.success) return result
    // Electron path failed — log and fall through to system commands
    console.warn('[screenshot] Electron desktopCapturer failed, falling back to system command:', (result as ScreenshotError).error)
  }

  // CLI / server fallback
  return captureScreenshotSystem({
    filename: options.filename,
    directory: options.directory,
  })
}

/**
 * Computer control tools - mouse, keyboard, window management.
 * Cross-platform: macOS / Windows / Linux.
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const execAsync = promisify(execFile)

// ─── Platform detection ────────────────────────────────────────────────────

type Platform = 'darwin' | 'win32' | 'linux'
const platform: Platform =
  process.platform === 'darwin' || process.platform === 'win32' || process.platform === 'linux'
    ? process.platform as Platform
    : 'linux'

function isMac() { return platform === 'darwin' }
function isWin() { return platform === 'win32' }
function isLinux() { return platform === 'linux' }

// ─── Helpers ─────────────────────────────────────────────────────────────

async function win32Script(script: string): Promise<string> {
  const psPath = join(tmpdir(), `win32-${Date.now()}.ps1`)
  writeFileSync(psPath, script, 'utf-8')
  try {
    const { stdout } = await execAsync('powershell', ['-ExecutionPolicy', 'Bypass', '-File', psPath])
    return stdout
  } finally {
    try { unlinkSync(psPath) } catch {}
  }
}

// ─── Mouse control ─────────────────────────────────────────────────────────

export async function mouseMove(x: number, y: number): Promise<{ success: true; x: number; y: number } | { success: false; error: string }> {
  try {
    if (isMac()) {
      await execAsync('cliclick', ['m:' + x + ',' + y])
    } else if (isWin()) {
      await win32Script(`Add-Type -AssemblyName System.Drawing; [System.Drawing.Cursor]::Position = [System.Drawing.Point]::new(${x}, ${y})`)
    } else if (isLinux()) {
      await execAsync('xdotool', ['mousemove', String(x), String(y)])
    }
    return { success: true, x, y }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function mouseClick(button: 'left' | 'right' | 'double' = 'left'): Promise<{ success: true; button: string; x: number; y: number } | { success: false; error: string }> {
  try {
    if (isMac()) {
      if (button === 'double') await execAsync('cliclick', ['d'])
      else await execAsync('cliclick', ['c:' + button])
    } else if (isWin()) {
      const btn = button === 'right' ? 'Right' : 'Left'
      await win32Script(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MouseButtons]::${btn}`)
    } else if (isLinux()) {
      const btn = button === 'right' ? 3 : 1
      await execAsync('xdotool', ['click', String(btn)])
    }
    return { success: true, button, x: 0, y: 0 }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function mouseDrag(x1: number, y1: number, x2: number, y2: number): Promise<{ success: true } | { success: false; error: string }> {
  try {
    if (isMac()) {
      await execAsync('cliclick', ['m:' + x1 + ',' + y1])
      await execAsync('cliclick', ['d'])
      await execAsync('cliclick', ['m:' + x2 + ',' + y2])
    } else if (isWin()) {
      await win32Script(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = [System.Drawing.Point]::new(${x1},${y1}); Start-Sleep -Milliseconds 100`)
    } else if (isLinux()) {
      await execAsync('xdotool', ['mousemove', String(x1), String(y1), 'mousemove', 'relative', '--', String(x2 - x1), String(y2 - y1)])
    }
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ─── Keyboard control ──────────────────────────────────────────────────────

export async function keyboardType(text: string): Promise<{ success: true } | { success: false; error: string }> {
  try {
    if (isMac()) {
      await execAsync('cliclick', ['t:' + text])
    } else if (isWin()) {
      await win32Script(`
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::Send("${text.replace(/"/g, '""')}")
`)
    } else if (isLinux()) {
      await execAsync('xdotool', ['type', '--', text])
    }
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function keyboardHotkey(...keys: string[]): Promise<{ success: true } | { success: false; error: string }> {
  try {
    if (isMac()) {
      const macKeys = keys.map(k => {
        const map: Record<string, string> = { ctrl: '^', cmd: '@', command: '@', alt: '~', shift: '$', super: '@' }
        return map[k.toLowerCase()] ?? k.toUpperCase()
      }).join('')
      await execAsync('cliclick', ['k' + macKeys])
    } else if (isWin()) {
      const winKeys = keys.map(k => {
        const map: Record<string, string> = { ctrl: '^', alt: '%', shift: '+', enter: '{ENTER}', escape: '{ESC}' }
        return map[k.toLowerCase()] ?? k.toUpperCase()
      }).join('')
      await win32Script(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::Send("${winKeys}")`)
    } else if (isLinux()) {
      await execAsync('xdotool', ['key', '--', keys.join('+')])
    }
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ─── Window management ─────────────────────────────────────────────────────

export async function windowActivate(titlePattern: string): Promise<{ success: true; title: string } | { success: false; error: string }> {
  try {
    if (isMac()) {
      await execAsync('osascript', ['-e', `activate application "${titlePattern}"`])
    } else if (isWin()) {
      await win32Script(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Application]::ActivateApplication("${titlePattern}")`)
    } else if (isLinux()) {
      await execAsync('xdotool', ['search', '--name', titlePattern, 'windowactivate'])
    }
    return { success: true, title: titlePattern }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function getScreenSize(): Promise<{ success: true; width: number; height: number } | { success: false; error: string }> {
  try {
    if (isMac()) {
      const { stdout } = await execAsync('osascript', ['-e', 'get bounds of window 1 of (do shell script "screen")'])
      const parts = stdout.trim().split(', ')
      return { success: true, width: Number(parts[2]) || 1920, height: Number(parts[3]) || 1080 }
    } else if (isWin()) {
      const out = await win32Script(`
Add-Type -AssemblyName System.Windows.Forms
$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
Write-Output "$($b.Width)x$($b.Height)"
`)
      const [w, h] = out.trim().split('x').map(Number)
      return { success: true, width: w || 1920, height: h || 1080 }
    } else if (isLinux()) {
      const { stdout } = await execAsync('xdotool', ['getdisplaygeometry'])
      const [w, h] = stdout.trim().split(' ').map(Number)
      return { success: true, width: w || 1920, height: h || 1080 }
    }
    return { success: false, error: 'Unknown platform' }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}
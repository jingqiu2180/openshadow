import { execFile } from 'child_process'
import { promisify } from 'util'
import { PathGuard } from './path-guard.js'

const execAsync = promisify(execFile)

const DANGEROUS_PATTERNS = [
  'rm -rf /',
  ':(){:|:&};:',      // fork bomb
  'mkfs',
  'dd if=/dev/zero of=/dev/sda',
  '> /dev/sda',
  'chmod -R 000 /',
  'wget .* \\| sh',
  'curl .* \\| sh',
]

export type BashResult = { success: true; stdout: string; stderr: string; exitCode: number }
export type BashError = { success: false; error: string }
export type BashOutput = BashResult | BashError

function isCommandSafe(command: string): boolean {
  return !DANGEROUS_PATTERNS.some(pattern => command.includes(pattern))
}

/**
 * Find a Unix-like shell on Windows. child_process.execFile goes through cmd.exe
 * by default which eats backslashes; using bash.exe keeps paths intact.
 */
function pickShell(): { cmd: string; prefixArgs: string[] } | null {
  if (process.platform !== 'win32') return null
  // Common Git Bash locations
  const candidates = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    'C:\\Windows\\System32\\bash.exe',
  ]
  for (const c of candidates) {
    try { require('fs').accessSync(c); return { cmd: c, prefixArgs: ['-c'] } } catch {}
  }
  // Fallback to PATH lookup
  return { cmd: 'bash.exe', prefixArgs: ['-c'] }
}

export function createBashTools(guard?: PathGuard) {
  return {
    /**
     * Execute a bash command. Blocked patterns + path guard.
     * On Windows we prefer Git Bash to avoid cmd.exe eating backslashes.
     */
    bash: async ({ command, cwd }: { command: string; cwd?: string }): Promise<BashOutput> => {
      // Check cwd against path guard
      const effectiveCwd = cwd ?? process.cwd()
      if (guard) {
        try {
          guard.assertAllowed(effectiveCwd, 'read')
        } catch (e: any) {
          return { success: false, error: `Working directory not allowed: ${e.message}` }
        }
      }

      if (!isCommandSafe(command)) {
        return {
          success: false,
          error: 'Command blocked by security policy: contains dangerous pattern',
        }
      }

      try {
        const shell = pickShell()
        const execOpts: any = {
          cwd: effectiveCwd,
          timeout: 30_000,
          maxBuffer: 1024 * 1024,
          encoding: 'utf8',  // execFile returns string (not Buffer) only with explicit encoding
          // Force UTF-8 output on Windows
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        }

        let stdout: string, stderr: string
        if (shell) {
          // Windows: invoke bash -c <command>
          const r = await execAsync(shell.cmd, [...shell.prefixArgs, command], execOpts)
          stdout = String(r.stdout); stderr = String(r.stderr)
        } else {
          // macOS/Linux: use /bin/bash -c (or sh)
          const r = await execAsync('/bin/bash', ['-c', command], execOpts)
          stdout = String(r.stdout); stderr = String(r.stderr)
        }

        return {
          success: true,
          stdout: (stdout ?? '').slice(0, 50_000),
          stderr: (stderr ?? '').slice(0, 10_000),
          exitCode: 0,
        }
      } catch (e: any) {
        if (e.killed) {
          return { success: false, error: 'Command timed out (30s limit)' }
        }
        return {
          success: false,
          error: e.message,
        }
      }
    },
  }
}

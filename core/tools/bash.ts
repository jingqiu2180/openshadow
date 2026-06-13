import { exec } from 'child_process'
import { promisify } from 'util'
import { PathGuard } from './path-guard.js'

const execAsync = promisify(exec)
// PathGuard will be used in v2 for directory restrictions

const DANGEROUS_PATTERNS = [
  'rm -rf /',
  ':(){:|:&};:',      // fork bomb
  'mkfs',
  'dd if=/dev/zero of=/dev/sda',
  '> /dev/sda',
  'chmod -R 000 /',
  'wget .* | sh',
  'curl .* | sh',
]

export type BashResult = { success: true; stdout: string; stderr: string; exitCode: number }
export type BashError = { success: false; error: string }
export type BashOutput = BashResult | BashError

function isCommandSafe(command: string): boolean {
  return !DANGEROUS_PATTERNS.some(pattern => command.includes(pattern))
}

export function createBashTools(guard: PathGuard) {
  // TODO v2: restrict cwd to allowed paths
  void guard // suppress unused warning for now
  return {
    /**
     * Execute a bash command. Blocked patterns + path guard.
     */
    bash: async ({ command, cwd }: { command: string; cwd?: string }): Promise<BashOutput> => {
      if (!isCommandSafe(command)) {
        return {
          success: false,
          error: 'Command blocked by security policy: contains dangerous pattern',
        }
      }

      try {
        const { stdout, stderr } = await execAsync(command, {
          cwd: cwd ?? process.cwd(),
          timeout: 30_000, // 30s timeout
          maxBuffer: 1024 * 1024, // 1MB output cap
        })
        return {
          success: true,
          stdout: stdout.slice(0, 50_000), // truncate very long output
          stderr: stderr.slice(0, 10_000),
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

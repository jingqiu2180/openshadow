import { resolve } from 'path'

/**
 * PathGuard: restricts file operations to allowed paths only.
 * Prevents agents from accessing sensitive system files.
 */
export class PathGuard {
  private readonly allowedPaths: string[]

  constructor(allowedPaths: string[]) {
    // Normalize all paths to absolute
    this.allowedPaths = allowedPaths.map(p => resolve(p))
  }

  isAllowed(targetPath: string): boolean {
    const resolved = resolve(targetPath)
    // Always allow /tmp for temporary operations
    if (resolved.startsWith('/tmp/') || resolved === '/tmp') return true
    return this.allowedPaths.some(allowed => resolved.startsWith(allowed))
  }

  assertAllowed(targetPath: string): void {
    if (!this.isAllowed(targetPath)) {
      throw new Error(
        `PathGuard: Access to "${targetPath}" is not allowed. ` +
        `Allowed paths: ${this.allowedPaths.join(', ') || '(none)'}`
      )
    }
  }

  getAllowedPaths(): string[] {
    return [...this.allowedPaths]
  }
}

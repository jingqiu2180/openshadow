// @ts-nocheck
/**
 * PathGuard v2: 4-level access control (OpenShadow-style)
 *
 * Access levels:
 *   BLOCKED   — no access
 *   READ_ONLY — read only
 *   READ_WRITE — read + write (no delete)
 *   FULL       — read + write + delete
 *
 * Priority (highest → lowest):
 *   1. Blocked paths (explicit deny)
 *   2. FULL paths (workspaceRoots)
 *   3. READ_WRITE paths (explicit writable)
 *   4. READ_ONLY paths (home dir, allowExternalReads)
 *   5. BLOCKED (default deny)
 */

import { resolve, sep } from 'path'
import { readlinkSync, statSync } from 'fs'

export type AccessLevel = 'BLOCKED' | 'READ_ONLY' | 'READ_WRITE' | 'FULL'

export interface PathGuardPolicy {
  /** If true, skip all checks (dev mode) */
  mode: 'full-access' | 'restricted'
  /** OpenShadow home dir (openshadow data dir) */
  openshadowHome: string
  /** Agent data dir */
  agentDir: string
  /** FULL access: workspace roots (user-configurable) */
  workspaceRoots: string[]
  /** READ_WRITE: explicitly allowed writable paths */
  writablePaths: string[]
  /** Allow reading files outside workspace (read-only) */
  allowExternalReads: boolean
}

const DEFAULT_BLOGYED_FILES: string[] = []
const DEFAULT_BLOGYED_DIRS: string[] = []

function norm(p: string): string {
  return resolve(p)
}

/**
 * Resolve real path (follow symlinks, handle missing trailing segments)
 */
function resolveReal(p: string): string {
  const abs = resolve(p)
  try {
    const st = statSync(abs)
    if ((st as any).isSymbolicLink?.()) {
      return norm(readlinkSync(abs))
    }
    return abs
  } catch {
    const parent = resolve(abs, '..')
    if (parent === abs) return abs
    const resolvedParent = resolveReal(parent)
    const rest = abs.slice(resolvedParent.length + 1).split(sep).filter(Boolean).join(sep)
    return resolvedParent + (rest ? sep + rest : '')
  }
}

export class PathGuard {
  private readonly policy: PathGuardPolicy
  private readonly blockedFiles: Set<string>
  private readonly blockedDirs: Set<string>
  private readonly workspaceRoots: string[]
  private readonly writablePaths: string[]

  /**
   * Constructor accepts either a policy object or a string[] (backward compatible).
   * If string[] is passed, creates a READ_ONLY policy with those paths.
   */
  constructor(input: PathGuardPolicy | string[]) {
    if (Array.isArray(input)) {
      // Backward compatible: string[] → READ_ONLY policy
      this.policy = {
        mode: 'restricted',
        openshadowHome: '',
        agentDir: '',
        workspaceRoots: [],
        writablePaths: input.map(norm),
        allowExternalReads: true,
      }
    } else {
      this.policy = input
    }

    if (this.policy.mode === 'full-access') {
      this.blockedFiles = new Set()
      this.blockedDirs = new Set()
      this.workspaceRoots = []
      this.writablePaths = []
      return
    }
    this.workspaceRoots = this.policy.workspaceRoots.map(norm)
    this.writablePaths = [...this.policy.writablePaths.map(norm), ...this.workspaceRoots]
    this.blockedFiles = new Set(DEFAULT_BLOGYED_FILES.map(norm))
    this.blockedDirs = new Set(DEFAULT_BLOGYED_DIRS.map(norm))
  }

  isFullAccess(): boolean {
    return this.policy.mode === 'full-access'
  }

  /**
   * Get access level for a path.
   */
  getAccessLevel(rawPath: string): AccessLevel {
    if (this.policy.mode === 'full-access') return 'FULL'

    const target = resolveReal(rawPath)

    // 1. Blocked (highest priority deny)
    if (this.blockedFiles.has(target)) return 'BLOCKED'
    for (const dir of this.blockedDirs) {
      if (target === dir || target.startsWith(dir + sep)) return 'BLOCKED'
    }

    // 2. FULL: workspace roots
    for (const root of this.workspaceRoots) {
      if (target === root || target.startsWith(root + sep)) return 'FULL'
    }

    // 3. READ_WRITE: explicit writable paths
    for (const p of this.writablePaths) {
      if (target === p || target.startsWith(p + sep)) return 'READ_WRITE'
    }

    // 4. READ_ONLY: external reads
    if (this.policy.allowExternalReads) return 'READ_ONLY'

    return 'BLOCKED'
  }

  /**
   * Check if operation is allowed on path.
   * Returns { allowed, reason }.
   */
  check(rawPath: string, operation: 'read' | 'write' | 'delete'): { allowed: boolean; reason?: string } {
    if (this.policy.mode === 'full-access') return { allowed: true }

    const level = this.getAccessLevel(rawPath)

    if (level === 'BLOCKED') {
      return { allowed: false, reason: `Path "${rawPath}" is blocked` }
    }

    if (operation === 'read') {
      return { allowed: true }
    }

    if (operation === 'delete') {
      if (level === 'FULL') return { allowed: true }
      return { allowed: false, reason: `Delete not allowed (need FULL access, got ${level})` }
    }

    // write
    if (level === 'READ_ONLY') {
      return { allowed: false, reason: `Write not allowed (read-only access to "${rawPath}")` }
    }
    return { allowed: true }
  }

  /**
   * Check if path is allowed for a specific operation.
   * Throws if blocked.
   */
  assertAllowed(rawPath: string, operation: 'read' | 'write' | 'delete'): void {
    const result = this.check(rawPath, operation)
    if (!result.allowed) {
      throw new Error(`PathGuard: ${result.reason}`)
    }
  }

  getPolicy(): PathGuardPolicy {
    return {
      ...this.policy,
      workspaceRoots: [...this.workspaceRoots],
      writablePaths: [...this.writablePaths],
    }
  }

  /** Check if a path would have FULL access */
  isWorkspacePath(rawPath: string): boolean {
    return this.getAccessLevel(rawPath) === 'FULL'
  }

  /**
   * Simple allowed check (backward compatible).
   * Returns true if path has at least READ_ONLY access.
   */
  isAllowed(rawPath: string): boolean {
    return this.getAccessLevel(rawPath) !== 'BLOCKED'
  }

  /**
   * Static helper: create PathGuard from string[] (backward compatible).
   * Creates a READ_WRITE policy for the given paths.
   */
  static fromPaths(paths: string[]): PathGuard {
    return new PathGuard(paths)
  }
}

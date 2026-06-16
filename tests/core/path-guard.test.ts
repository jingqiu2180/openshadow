import { describe, it, expect } from 'vitest'
import { PathGuard } from '../../core/tools/path-guard.js'
import { join } from 'path'
import { tmpdir } from 'os'

describe('PathGuard', () => {
  const tmpDir = tmpdir()

  it('should allow full access in full-access mode', () => {
    const guard = new PathGuard({ mode: 'full-access', remuHome: '', agentDir: '', workspaceRoots: [], writablePaths: [], allowExternalReads: false })
    expect(guard.isFullAccess()).toBe(true)
    expect(guard.check('/etc/passwd', 'read').allowed).toBe(true)
    expect(guard.check('/etc/passwd', 'write').allowed).toBe(true)
    expect(guard.check('/etc/passwd', 'delete').allowed).toBe(true)
  })

  it('should grant FULL access to workspace roots', () => {
    const guard = new PathGuard({
      mode: 'restricted',
      remuHome: '',
      agentDir: '',
      workspaceRoots: [tmpDir],
      writablePaths: [],
      allowExternalReads: false,
    })

    const fileInWorkspace = join(tmpDir, 'test.txt')
    expect(guard.getAccessLevel(fileInWorkspace)).toBe('FULL')
    expect(guard.check(fileInWorkspace, 'read').allowed).toBe(true)
    expect(guard.check(fileInWorkspace, 'write').allowed).toBe(true)
    expect(guard.check(fileInWorkspace, 'delete').allowed).toBe(true)
  })

  it('should grant READ_WRITE to writable paths', () => {
    const writableDir = join(tmpDir, 'writable-area')
    const guard = new PathGuard({
      mode: 'restricted',
      remuHome: '',
      agentDir: '',
      workspaceRoots: [],
      writablePaths: [writableDir],
      allowExternalReads: false,
    })

    const file = join(writableDir, 'data.txt')
    expect(guard.getAccessLevel(file)).toBe('READ_WRITE')
    expect(guard.check(file, 'read').allowed).toBe(true)
    expect(guard.check(file, 'write').allowed).toBe(true)
    expect(guard.check(file, 'delete').allowed).toBe(false)
  })

  it('should grant READ_ONLY when allowExternalReads is true', () => {
    const guard = new PathGuard({
      mode: 'restricted',
      remuHome: '',
      agentDir: '',
      workspaceRoots: [],
      writablePaths: [],
      allowExternalReads: true,
    })

    expect(guard.getAccessLevel('/some/external/file.txt')).toBe('READ_ONLY')
    expect(guard.check('/some/external/file.txt', 'read').allowed).toBe(true)
    expect(guard.check('/some/external/file.txt', 'write').allowed).toBe(false)
    expect(guard.check('/some/external/file.txt', 'delete').allowed).toBe(false)
  })

  it('should BLOCK when allowExternalReads is false', () => {
    const guard = new PathGuard({
      mode: 'restricted',
      remuHome: '',
      agentDir: '',
      workspaceRoots: [],
      writablePaths: [],
      allowExternalReads: false,
    })

    expect(guard.getAccessLevel('/some/external/file.txt')).toBe('BLOCKED')
    expect(guard.check('/some/external/file.txt', 'read').allowed).toBe(false)
  })

  it('should assert allowed and throw on blocked', () => {
    const guard = new PathGuard({
      mode: 'restricted',
      remuHome: '',
      agentDir: '',
      workspaceRoots: [],
      writablePaths: [],
      allowExternalReads: false,
    })

    expect(() => guard.assertAllowed('/blocked/file.txt', 'write')).toThrow('PathGuard')
  })

  it('should not throw when assertAllowed passes', () => {
    const guard = new PathGuard({
      mode: 'restricted',
      remuHome: '',
      agentDir: '',
      workspaceRoots: [tmpDir],
      writablePaths: [],
      allowExternalReads: false,
    })

    expect(() => guard.assertAllowed(join(tmpDir, 'ok.txt'), 'write')).not.toThrow()
  })

  it('should support backward-compatible string[] constructor', () => {
    const writableDir = join(tmpDir, 'legacy-area')
    const guard = new PathGuard([writableDir])

    const file = join(writableDir, 'data.txt')
    expect(guard.getAccessLevel(file)).toBe('READ_WRITE')
    expect(guard.check(file, 'read').allowed).toBe(true)
    expect(guard.check(file, 'write').allowed).toBe(true)
  })

  it('should check isWorkspacePath', () => {
    const guard = new PathGuard({
      mode: 'restricted',
      remuHome: '',
      agentDir: '',
      workspaceRoots: [tmpDir],
      writablePaths: [],
      allowExternalReads: false,
    })

    expect(guard.isWorkspacePath(join(tmpDir, 'file.txt'))).toBe(true)
    expect(guard.isWorkspacePath('/other/path')).toBe(false)
  })

  it('should check isAllowed', () => {
    const guard = new PathGuard({
      mode: 'restricted',
      remuHome: '',
      agentDir: '',
      workspaceRoots: [tmpDir],
      writablePaths: [],
      allowExternalReads: true,
    })

    expect(guard.isAllowed(join(tmpDir, 'file.txt'))).toBe(true)
    expect(guard.isAllowed('/external/readable.txt')).toBe(true)
  })

  it('should return policy via getPolicy', () => {
    const policy = {
      mode: 'restricted' as const,
      remuHome: '/home/remu',
      agentDir: '/home/remu/agents',
      workspaceRoots: [tmpDir],
      writablePaths: [],
      allowExternalReads: true,
    }
    const guard = new PathGuard(policy)
    const retrieved = guard.getPolicy()
    expect(retrieved.mode).toBe('restricted')
    expect(retrieved.workspaceRoots).toContain(tmpDir)
  })

  it('should create from static fromPaths', () => {
    const guard = PathGuard.fromPaths([tmpDir])
    expect(guard.getAccessLevel(join(tmpDir, 'test.txt'))).toBe('READ_WRITE')
  })
})

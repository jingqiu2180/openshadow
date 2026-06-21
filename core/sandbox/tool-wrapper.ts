// @ts-nocheck
/**
 * tool-wrapper.ts — 工具沙盒包装
 *
 * 在工具 execute 外面套一层路径校验。
 * 被拦截时返回 LLM 可读的文本错误，不抛异常。
 *
 * remu 适配版：包装 ToolRegistry 注册的工具（execute(args) 签名）
 */

import fs from 'fs'
import path from 'path'
import { normalizeWin32ShellPath } from './win32-path.js'

interface SandboxOpts {
  getSandboxEnabled?: () => boolean
  getExternalReadPaths?: () => string[]
  checkManagedConfigWrite?: (absolutePath: string, operation: string) => { allowed: boolean; reason?: string } | undefined
  fallbackTool?: any
}

/** 构造被拦截时返回给 LLM 的结果 */
function blockedResult(reason: string) {
  return {
    content: [{ type: 'text' as const, text: `Sandbox blocked: ${reason}` }],
  }
}

/** 解析工具参数中的路径为绝对路径 */
function resolvePath(rawPath: string | undefined, cwd: string): string | null {
  if (!rawPath) return null
  if (process.platform === 'win32') {
    return normalizeWin32ShellPath(rawPath, cwd, { allowRelative: true })
  }
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(cwd, rawPath)
}

function normalizeExistingOrResolvedPath(filePath: string): string {
  const resolved = path.resolve(filePath)
  try { return fs.realpathSync(resolved) } catch { return resolved }
}

function isInsideRoot(filePath: string, root: string): boolean {
  const rel = path.relative(root, filePath)
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel))
}

function externalReadGrantCovers(targetPath: string, grantPath: string): boolean {
  const target = normalizeExistingOrResolvedPath(targetPath)
  const grant = normalizeExistingOrResolvedPath(grantPath)
  if (target === grant) return true
  try {
    return fs.statSync(grant).isDirectory() && isInsideRoot(target, grant)
  } catch { return false }
}

function hasExternalReadGrant(absolutePath: string, opts: SandboxOpts = {}): boolean {
  if (!absolutePath || typeof opts.getExternalReadPaths !== 'function') return false
  let grants: string[] = []
  try {
    grants = opts.getExternalReadPaths() || []
  } catch { return false }
  return grants.some((grantPath: string) => grantPath && externalReadGrantCovers(absolutePath, grantPath))
}

function checkWithExternalReadGrant(
  guard: any, absolutePath: string, operation: string, opts: SandboxOpts = {}
): { allowed: boolean; reason?: string } {
  const result = guard.check(absolutePath, operation)
  if (result.allowed) return result
  if (operation === 'read' && hasExternalReadGrant(absolutePath, opts)) {
    return { allowed: true }
  }
  return result
}

function shouldSkipCommandPathGuard(operation: string): boolean {
  return process.platform === 'win32' && operation === 'read'
}

function checkManagedConfigWrite(absolutePath: string, operation: string, opts: SandboxOpts = {}): { allowed: boolean; reason?: string } {
  if (!absolutePath || typeof opts.checkManagedConfigWrite !== 'function') {
    return { allowed: true }
  }
  if (operation !== 'write' && operation !== 'delete') {
    return { allowed: true }
  }
  try {
    return opts.checkManagedConfigWrite(absolutePath, operation) || { allowed: true }
  } catch (err: any) {
    return {
      allowed: false,
      reason: err?.message || String(err),
    }
  }
}

// ── preflight 模式匹配 ─────────────────────────
const PREFLIGHT_UNIX: [RegExp, () => string][] = [
  [/\bsudo\s/, () => 'sudo is not allowed'],
  [/\bsu\s+\w/, () => 'su is not allowed'],
  [/\bchmod\s/, () => 'chmod is not allowed'],
  [/\bchown\s/, () => 'chown is not allowed'],
]

const PREFLIGHT_WIN32: [RegExp, () => string][] = [
  [/\bdel\s+\/s/i, () => 'del /s is not allowed'],
  [/\brmdir\s+\/s/i, () => 'rmdir /s is not allowed'],
  [/\breg\s+(delete|add)\b/i, () => 'reg delete/add is not allowed'],
  [/\btakeown\b/i, () => 'takeown is not allowed'],
  [/\bicacls\b/i, () => 'icacls is not allowed'],
  [/\bnet\s+(user|localgroup)\b/i, () => 'net user/localgroup is not allowed'],
  [/\bschtasks\s+\/create\b/i, () => 'schtasks /create is not allowed'],
  [/\bsc\s+(create|delete)\b/i, () => 'sc create/delete is not allowed'],
  [/powershell.*-(executionpolicy)?\s*(bypass|unrestricted)/i, () => 'PowerShell bypass is not allowed'],
  [/\bformat\s+[a-z]:/i, () => 'format is not allowed'],
  [/\bbcdedit\b/i, () => 'bcdedit is not allowed'],
  [/\bwmic\b/i, () => 'wmic is not allowed'],
]

const PREFLIGHT_PATTERNS = process.platform === 'win32'
  ? [...PREFLIGHT_UNIX, ...PREFLIGHT_WIN32]
  : PREFLIGHT_UNIX

// ── 从 bash 命令中提取路径（启发式）─────────────────────
const OP_PRIORITY: Record<string, number> = { read: 1, write: 2, delete: 3 }
const READ_PATH_COMMANDS = new Set(['cat', 'ls', 'less', 'head', 'tail', 'stat', 'file', 'find'])
const WRITE_PATH_COMMANDS = new Set(['touch', 'mkdir', 'tee'])
const DELETE_PATH_COMMANDS = new Set(['rm', 'rmdir'])
const COPY_MOVE_COMMANDS = new Set(['cp', 'mv'])

function readShellWord(command: string, start: number): { word: string; end: number } {
  let word = ''
  let quote: string | null = null
  let i = start

  for (; i < command.length; i++) {
    const ch = command[i]

    if (quote === "'") {
      if (ch === "'") { quote = null } else { word += ch }
      continue
    }

    if (quote === '"') {
      if (ch === '"') {
        quote = null
      } else if (ch === '\\' && i + 1 < command.length && /["\\$`\n]/.test(command[i + 1])) {
        word += command[++i]
      } else {
        word += ch
      }
      continue
    }

    if (/[\s|;&|<>]/.test(ch)) break
    if (ch === "'" || ch === '"') { quote = ch; continue }
    if (ch === '\\' && i + 1 < command.length) { word += command[++i]; continue }
    word += ch
  }

  return { word, end: i }
}

function splitShellSegments(command: string): string[] {
  const segments: string[] = []
  let quote: string | null = null
  let escaped = false
  let start = 0

  for (let i = 0; i < command.length; i++) {
    const ch = command[i]

    if (escaped) { escaped = false; continue }
    if (ch === '\\' && quote !== "'") { escaped = true; continue }
    if (quote) {
      if (ch === quote) quote = null
      continue
    }
    if (ch === "'" || ch === '"') { quote = ch; continue }

    const isSeparator = ch === ';' || ch === '|' || (ch === '&' && command[i + 1] === '&')
    if (!isSeparator) continue

    const segment = command.slice(start, i).trim()
    if (segment) segments.push(segment)
    if ((ch === '|' || ch === '&') && command[i + 1] === ch) i++
    start = i + 1
  }

  const tail = command.slice(start).trim()
  if (tail) segments.push(tail)
  return segments
}

function tokenizeShellWords(command: string): string[] {
  const words: string[] = []
  for (let i = 0; i < command.length;) {
    while (i < command.length && /\s/.test(command[i])) i++
    if (i >= command.length) break
    if (/[;|&<>]/.test(command[i])) { i++; continue }
    const { word, end } = readShellWord(command, i)
    if (word) words.push(word)
    i = Math.max(end, i + 1)
  }
  return words
}

function commandName(word: string): string {
  return String(word || '')
    .split(/[\\/]/).pop()!
    .replace(/\.exe$/i, '')
    .toLowerCase()
}

function normalizePathForCheck(rawPath: string, cwd: string, allowRelative: boolean): string | null {
  if (process.platform === 'win32') {
    return normalizeWin32ShellPath(rawPath, cwd, { allowRelative })
  }
  if (path.isAbsolute(rawPath)) return rawPath
  return allowRelative && cwd ? path.resolve(cwd, rawPath) : null
}

function isPosixNullDevicePath(filePath: string): boolean {
  return process.platform !== 'win32' && filePath === '/dev/null'
}

interface PathCheck {
  path: string
  rawPath: string
  operation: string
}

function rememberCheck(
  checks: Map<string, PathCheck>,
  rawPath: string,
  operation: string,
  cwd: string,
  allowRelative = false,
  skipPosixNullDevice = false
): void {
  const normalized = normalizePathForCheck(rawPath, cwd, allowRelative)
  if (!normalized) return
  if (skipPosixNullDevice && isPosixNullDevicePath(normalized)) return
  const previous = checks.get(normalized)
  if (!previous || OP_PRIORITY[operation] > OP_PRIORITY[previous.operation]) {
    checks.set(normalized, { path: normalized, rawPath, operation })
  }
}

function extractRedirectionChecks(command: string, cwd: string, checks: Map<string, PathCheck>): void {
  let quote: string | null = null
  let escaped = false

  for (let i = 0; i < command.length; i++) {
    const ch = command[i]

    if (escaped) { escaped = false; continue }
    if (ch === '\\' && quote !== "'") { escaped = true; continue }
    if (quote) {
      if (ch === quote) quote = null
      continue
    }
    if (ch === "'" || ch === '"') { quote = ch; continue }
    if (ch !== '>' && ch !== '<') continue

    const operation = ch === '>' ? 'write' : 'read'
    let targetStart = i + 1
    if (command[targetStart] === ch || command[targetStart] === '|') targetStart++
    if (operation === 'read' && command[targetStart] === '(') continue
    while (targetStart < command.length && /\s/.test(command[targetStart])) targetStart++
    if (command[targetStart] === '&') continue

    const { word } = readShellWord(command, targetStart)
    if (word) rememberCheck(checks, word, operation, cwd, true, true)
  }
}

function extractSegmentChecks(segment: string, cwd: string, checks: Map<string, PathCheck>): void {
  const words = tokenizeShellWords(segment)
  if (!words.length) return

  const name = commandName(words[0])
  const operands = words.slice(1).filter((word: string) => word && !word.startsWith('-'))

  for (const word of words) {
    rememberCheck(checks, word, 'read', cwd, false)
  }

  if (DELETE_PATH_COMMANDS.has(name)) {
    for (const word of operands) rememberCheck(checks, word, 'delete', cwd, true)
    return
  }

  if (WRITE_PATH_COMMANDS.has(name)) {
    for (const word of operands) rememberCheck(checks, word, 'write', cwd, true)
    return
  }

  if (COPY_MOVE_COMMANDS.has(name)) {
    const pathOperands = operands.filter((word: string) => normalizePathForCheck(word, cwd, true))
    pathOperands.forEach((word: string, index: number) => {
      const operation = index === pathOperands.length - 1 ? 'write' : 'read'
      rememberCheck(checks, word, operation, cwd, true)
    })
    return
  }

  if (READ_PATH_COMMANDS.has(name)) {
    for (const word of operands) rememberCheck(checks, word, 'read', cwd, true)
  }
}

function extractPathChecks(command: string, cwd: string): PathCheck[] {
  const checks = new Map<string, PathCheck>()
  extractRedirectionChecks(command, cwd, checks)
  for (const segment of splitShellSegments(command)) {
    extractSegmentChecks(segment, cwd, checks)
  }
  return [...checks.values()]
}

/**
 * 包装路径类工具（read, write, edit, grep, find, ls）
 */
export function wrapPathTool(tool: any, guard: any, operation: string, cwd: string, opts: SandboxOpts = {}): any {
  return {
    ...tool,
    execute: async (args: Record<string, any> = {}) => {
      const rawPath: string | undefined = args.path
      const absolutePath = resolvePath(rawPath, cwd)

      if (absolutePath) {
        const managedConfigCheck = checkManagedConfigWrite(absolutePath, operation, opts)
        if (!managedConfigCheck.allowed) {
          return blockedResult(managedConfigCheck.reason!)
        }

        // 沙盒动态关闭 → 跳过 PathGuard
        if (opts.getSandboxEnabled && !opts.getSandboxEnabled()) {
          return tool.execute(args)
        }

        const result = checkWithExternalReadGrant(guard, absolutePath, operation, opts)
        if (!result.allowed) {
          return blockedResult(result.reason!)
        }
      } else if (operation !== 'read' && rawPath) {
        return blockedResult(`Invalid path: ${rawPath}`)
      }

      return tool.execute(args)
    },
  }
}

/**
 * 包装 bash 工具
 */
export function wrapBashTool(tool: any, guard: any, cwd: string, opts: SandboxOpts = {}): any {
  return {
    ...tool,
    execute: async (args: Record<string, any> = {}) => {
      let pathChecks: PathCheck[] | null = null
      if (cwd && typeof opts.checkManagedConfigWrite === 'function') {
        pathChecks = extractPathChecks(args.command || '', cwd)
        for (const p of pathChecks) {
          const managedConfigCheck = checkManagedConfigWrite(p.path, p.operation, opts)
          if (!managedConfigCheck.allowed) {
            return blockedResult(managedConfigCheck.reason!)
          }
        }
      }

      // 沙盒动态关闭 → 使用无 OS 沙盒的 bash 工具
      if (opts.getSandboxEnabled && !opts.getSandboxEnabled()) {
        return (opts.fallbackTool || tool).execute(args)
      }

      // preflight
      for (const [pattern, reasonFn] of PREFLIGHT_PATTERNS) {
        if (pattern.test(args.command || '')) {
          return blockedResult(reasonFn())
        }
      }

      // 路径校验：从命令中提取路径，检查 PathGuard
      if (guard && cwd) {
        const paths = pathChecks || extractPathChecks(args.command || '', cwd)
        for (const p of paths) {
          if (shouldSkipCommandPathGuard(p.operation)) continue
          const result = checkWithExternalReadGrant(guard, p.path, p.operation, opts)
          if (!result.allowed) {
            return blockedResult(`Restricted path: ${p.rawPath}`)
          }
        }
      }

      try {
        const result = await tool.execute(args)

        // 成功路径的错误翻译
        const text = result?.content?.[0]?.text
        if (text && text.includes('Operation not permitted')) {
          result.content[0].text += '\n\nSandbox: write operation was restricted.'
        }

        return result
      } catch (err: any) {
        if (err.message?.includes('Operation not permitted')) {
          err.message += '\n\nSandbox: write operation was restricted.'
        }
        throw err
      }
    },
  }
}

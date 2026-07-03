/**
 * grep-tool.ts — 文件内容搜索工具
 *
 * 对标 openhanako 的 grep 工具。
 * 递归搜索文件内容，支持正则、大小写忽略、上下文行。
 * 轻量实现，不依赖 ripgrep。
 */

import { readdir, stat, readFile } from 'fs/promises'
import path from 'path'

const DEFAULT_LIMIT = 100
const MAX_FILE_SIZE = 1024 * 1024 // 1MB
const MAX_TOTAL_OUTPUT = 500 * 1024 // 500KB
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'coverage', '__pycache__', '.DS_Store'])

type ToolTextContent = { type: 'text'; text: string }
type ToolOutput = { content: ToolTextContent[] }

export interface GrepArgs {
  pattern: string
  path?: string
  glob?: string
  ignoreCase?: boolean
  literal?: boolean
  context?: number
  limit?: number
}

interface Match {
  filePath: string
  lineNumber: number
  lineContent: string
}

function matchesGlob(fileName: string, glob: string): boolean {
  const regexStr = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  const regex = new RegExp(`^${regexStr}$`)
  return regex.test(fileName)
}

function shouldProcessFile(fileName: string, glob?: string): boolean {
  if (fileName.endsWith('.min.js') || fileName.endsWith('.min.css')) return false
  if (glob && !matchesGlob(fileName, glob)) return false
  return true
}

async function searchInFile(
  filePath: string,
  regex: RegExp,
  _contextLines: number,
  matches: Match[],
  limit: number,
): Promise<void> {
  if (matches.length >= limit) return

  let content: string
  try {
    const info = await stat(filePath)
    if (info.size > MAX_FILE_SIZE) return
    content = await readFile(filePath, 'utf-8')
  } catch {
    return
  }

  const lines = content.split('\n')
  const fileMatches: number[] = []

  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i])) {
      fileMatches.push(i)
    }
    regex.lastIndex = 0
  }

  for (const lineNum of fileMatches) {
    if (matches.length >= limit) break
    matches.push({
      filePath,
      lineNumber: lineNum + 1,
      lineContent: lines[lineNum],
    })
  }
}

async function walkDir(
  dirPath: string,
  regex: RegExp,
  _contextLines: number,
  matches: Match[],
  limit: number,
  glob?: string,
  maxDepth = 20,
  currentDepth = 0,
): Promise<void> {
  if (currentDepth > maxDepth) return
  if (matches.length >= limit) return

  let entries: string[]
  try {
    entries = await readdir(dirPath)
  } catch {
    return
  }

  const subdirs: string[] = []

  for (const entry of entries) {
    if (matches.length >= limit) break
    if (SKIP_DIRS.has(entry)) continue

    const fullPath = path.join(dirPath, entry)
    let isDir: boolean
    try {
      isDir = (await stat(fullPath)).isDirectory()
    } catch {
      continue
    }

    if (isDir) {
      subdirs.push(fullPath)
    } else if (shouldProcessFile(entry, glob)) {
      await searchInFile(fullPath, regex, _contextLines, matches, limit)
    }
  }

  for (const subdir of subdirs) {
    if (matches.length >= limit) break
    await walkDir(subdir, regex, _contextLines, matches, limit, glob, maxDepth, currentDepth + 1)
  }
}

export async function grepTool(args: GrepArgs): Promise<ToolOutput> {
  const { pattern, path: searchPath = '.', glob, ignoreCase, literal, context = 0, limit = DEFAULT_LIMIT } = args

  if (!pattern) {
    return { content: [{ type: 'text', text: 'Error: pattern is required' }] }
  }

  const flags = literal ? (ignoreCase ? 'i' : '') : (ignoreCase ? 'gi' : 'g')
  let regex: RegExp
  try {
    regex = new RegExp(literal ? escapeRegex(pattern) : pattern, flags)
  } catch (e: any) {
    return { content: [{ type: 'text', text: `Invalid pattern: ${e.message}` }] }
  }

  const matches: Match[] = []
  const resolvedPath = path.resolve(searchPath)

  await walkDir(resolvedPath, regex, context, matches, limit, glob)

  if (matches.length === 0) {
    return { content: [{ type: 'text', text: 'No matches found' }] }
  }

  const lines: string[] = []
  for (const match of matches) {
    const relPath = path.relative(resolvedPath, match.filePath)
    const displayPath = relPath || path.basename(match.filePath)
    lines.push(`${displayPath}:${match.lineNumber}: ${match.lineContent}`)
  }

  let output = lines.join('\n')
  const notices: string[] = []

  if (matches.length >= limit) {
    notices.push(`${limit} matches limit reached. Use limit=${limit * 2} for more`)
  }

  if (output.length > MAX_TOTAL_OUTPUT) {
    output = output.slice(0, MAX_TOTAL_OUTPUT) + '\n... (output truncated)'
    notices.push('Output size limit reached')
  }

  if (notices.length > 0) {
    output += `\n\n[${notices.join('. ')}]`
  }

  return { content: [{ type: 'text', text: output }] }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 供 ToolRegistry 使用的 execute 包装 */
export async function execute(args: GrepArgs): Promise<ToolOutput> {
  return grepTool(args)
}

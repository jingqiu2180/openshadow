// @ts-nocheck
/**
 * find-tool.ts — 文件名搜索工具
 *
 * 对标 openhanako 的 find 工具。
 * 递归搜索匹配模式的文件路径。
 * 轻量实现，不依赖 fd。
 */

import { readdir, stat } from 'fs/promises'
import path from 'path'

const DEFAULT_LIMIT = 1000
const MAX_DEPTH = 20
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'coverage', '__pycache__', '.DS_Store'])

type ToolTextContent = { type: 'text'; text: string }
type ToolOutput = { content: ToolTextContent[] }

export interface FindArgs {
  pattern: string
  path?: string
  limit?: number
}

function matchesPattern(name: string, pattern: string): boolean {
  // 支持 * 和 ? 通配符，含 / 时匹配完整路径
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  const regex = new RegExp(`^${regexStr}$`)
  return regex.test(name)
}

async function walkDir(
  dirPath: string,
  basePath: string,
  pattern: string,
  results: string[],
  limit: number,
  maxDepth: number,
  currentDepth = 0,
): Promise<void> {
  if (currentDepth > maxDepth) return
  if (results.length >= limit) return

  let entries: string[]
  try {
    entries = await readdir(dirPath)
  } catch {
    return
  }

  const subdirs: string[] = []

  for (const entry of entries) {
    if (results.length >= limit) break
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
    }

    // 匹配文件名或相对路径
    const relPath = path.relative(basePath, fullPath)
    if (matchesPattern(entry, pattern) || matchesPattern(relPath, pattern)) {
      results.push(relPath || entry)
    }
  }

  for (const subdir of subdirs) {
    if (results.length >= limit) break
    await walkDir(subdir, basePath, pattern, results, limit, maxDepth, currentDepth + 1)
  }
}

export async function findTool(args: FindArgs): Promise<ToolOutput> {
  const { pattern, path: searchPath = '.', limit = DEFAULT_LIMIT } = args

  if (!pattern) {
    return { content: [{ type: 'text', text: 'Error: pattern is required' }] }
  }

  const resolvedPath = path.resolve(searchPath)
  const results: string[] = []

  await walkDir(resolvedPath, resolvedPath, pattern, results, limit, MAX_DEPTH)

  if (results.length === 0) {
    return { content: [{ type: 'text', text: 'No files found matching pattern' }] }
  }

  const notices: string[] = []
  if (results.length >= limit) {
    notices.push(`${limit} results limit reached. Use limit=${limit * 2} for more`)
  }

  let output = results.join('\n')
  if (notices.length > 0) {
    output += `\n\n[${notices.join('. ')}]`
  }

  return { content: [{ type: 'text', text: output }] }
}

/**
 * ls-tool.ts — 目录列表工具
 *
 * 对标 openhanako 的 ls 工具。
 * 列出目录内容，支持递归、过滤、格式化输出。
 */

import { readdir, stat } from 'fs/promises'
import path from 'path'

const DEFAULT_LIMIT = 1000
const MAX_DEPTH = 10

type ToolTextContent = { type: 'text'; text: string }
type ToolOutput = { content: ToolTextContent[] }

interface LsArgs {
  path: string
  all?: boolean          // 包含隐藏文件
  long?: boolean         // 详细格式
  recursive?: boolean    // 递归
  depth?: number        // 递归深度
  ignore?: string[]    // 忽略模式
}

function shouldIgnore(name: string, ignorePatterns: string[]): boolean {
  for (const pattern of ignorePatterns) {
    if (pattern.startsWith('*')) {
      if (name.endsWith(pattern.slice(1))) return true
    } else if (pattern.endsWith('*')) {
      if (name.startsWith(pattern.slice(0, -1))) return true
    } else {
      if (name === pattern) return true
    }
  }
  return false
}

async function listDir(
  dirPath: string,
  basePath: string,
  currentDepth: number,
  maxDepth: number,
  recursive: boolean,
  showAll: boolean,
  ignorePatterns: string[],
  longFormat: boolean,
  results: string[],
  isLast: boolean,
  prefix: string,
  limit: number,
): Promise<void> {
  if (results.length >= limit) return
  if (currentDepth > maxDepth) return

  let entries: string[]
  try {
    entries = await readdir(dirPath)
  } catch {
    return
  }

  if (!showAll) {
    entries = entries.filter(e => !e.startsWith('.'))
  }

  if (ignorePatterns.length > 0) {
    entries = entries.filter(e => !shouldIgnore(e, ignorePatterns))
  }

  for (let i = 0; i < entries.length; i++) {
    if (results.length >= limit) {
      results.push(`${prefix}... (limit ${limit} reached)`)
      return
    }

    const entry = entries[i]
    const entryPath = path.join(dirPath, entry)
    const isLastEntry = i === entries.length - 1
    const connector = isLastEntry ? '└── ' : '├── '
    const childPrefix = prefix + (isLast ? '    ' : '│   ')

    let isDir = false
    let size = 0
    let mtime = ''
    try {
      const info = await stat(entryPath)
      isDir = info.isDirectory()
      size = info.size
      mtime = info.mtime.toISOString().split('T')[0]
    } catch {
      // 无法读取 stat（权限问题），跳过
    }

    if (longFormat) {
      const type = isDir ? 'd' : '-'
      const sizeStr = isDir ? '' : String(size)
      const name = isDir ? `${entry}/` : entry
      results.push(`${prefix}${connector}${type} ${mtime} ${sizeStr} ${name}`)
    } else {
      const name = isDir ? `${entry}/` : entry
      results.push(`${prefix}${connector}${name}`)
    }

    if (isDir && recursive && currentDepth < maxDepth) {
      await listDir(
        entryPath, basePath, currentDepth + 1, maxDepth,
        recursive, showAll, ignorePatterns, longFormat,
        results, isLastEntry, childPrefix, limit,
      )
    }
  }
}

export async function lsTool(args: LsArgs): Promise<ToolOutput> {
  const targetPath = path.resolve(args.path || '.')
  const showAll = args.all ?? false
  const longFormat = args.long ?? false
  const recursive = args.recursive ?? false
  const maxDepth = Math.min(args.depth ?? (recursive ? 3 : 1), MAX_DEPTH)
  const ignorePatterns = args.ignore ?? ['node_modules', '.git', 'dist', 'build', '.next', '.nuxt']
  const limit = DEFAULT_LIMIT

  const results: string[] = []

  let isDir = false
  try {
    const info = await stat(targetPath)
    isDir = info.isDirectory()
  } catch (e: any) {
    return { content: [{ type: 'text', text: `Error: ${e.message}` }] }
  }

  if (!isDir) {
    return { content: [{ type: 'text', text: `${targetPath} is not a directory` }] }
  }

  results.push(targetPath)
  await listDir(
    targetPath, targetPath, 1, maxDepth,
    recursive, showAll, ignorePatterns, longFormat,
    results, true, '', limit,
  )

  return { content: [{ type: 'text', text: results.join('\n') }] }
}

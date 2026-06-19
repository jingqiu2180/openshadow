// @ts-nocheck
/**
 * edit-tool.ts — 文件编辑工具
 *
 * 对标 openhanako 的 edit 工具。
 * 在文件中查找 oldText 并替换为 newText。
 * 支持单条或全量替换。
 */

import { readFile, writeFile } from 'fs/promises'
import { stat } from 'fs/promises'

const MAX_FILE_SIZE = 1024 * 1024 * 2 // 2MB

type ToolTextContent = { type: 'text'; text: string }
type ToolOutput = { content: ToolTextContent[] }

export interface EditArgs {
  path: string
  oldText: string
  newText: string
  replaceAll?: boolean
}

function countOccurrences(content: string, search: string): number {
  let count = 0
  let pos = 0
  while ((pos = content.indexOf(search, pos)) !== -1) {
    count++
    pos += search.length || 1
  }
  return count
}

function getContext(content: string, _search: string, contextChars = 200): string {
  return content.slice(0, contextChars) + (content.length > contextChars ? '\n... (truncated)' : '')
}

export async function execute(args: EditArgs): Promise<ToolOutput> {
  const { path: filePath, oldText, newText, replaceAll } = args

  if (!filePath || oldText === undefined || newText === undefined) {
    return { content: [{ type: 'text', text: 'Error: path, oldText, newText are required' }] }
  }

  // 检查文件大小
  try {
    const info = await stat(filePath)
    if (info.size > MAX_FILE_SIZE) {
      return { content: [{ type: 'text', text: `Error: File too large: ${info.size} bytes (max ${MAX_FILE_SIZE})` }] }
    }
  } catch (e: any) {
    return { content: [{ type: 'text', text: `Error: Cannot stat file: ${e.message}` }] }
  }

  let content: string
  try {
    content = await readFile(filePath, 'utf-8')
  } catch (e: any) {
    return { content: [{ type: 'text', text: `Error: Cannot read file: ${e.message}` }] }
  }

  const occurrenceCount = countOccurrences(content, oldText)
  if (occurrenceCount === 0) {
    return { content: [{ type: 'text', text: `Error: oldText not found in file. Showing context:\n${getContext(content, oldText)}` }] }
  }

  if (!replaceAll && occurrenceCount > 1) {
    return {
      content: [{ type: 'text', text: `Error: oldText found ${occurrenceCount} times. Use replaceAll: true to replace all, or make oldText more specific.` }],
    }
  }

  if (replaceAll) {
    content = content.split(oldText).join(newText)
  } else {
    content = content.replace(oldText, newText)
  }

  try {
    await writeFile(filePath, content, 'utf-8')
    return {
      content: [{ type: 'text', text: `Edited ${filePath}: ${replaceAll ? occurrenceCount : 1} replacement(s)` }],
    }
  } catch (e: any) {
    return { content: [{ type: 'text', text: `Error: Cannot write file: ${e.message}` }] }
  }
}

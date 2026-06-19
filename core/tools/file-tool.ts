// @ts-nocheck
/**
 * file-tool.ts — 统一文件工具（stat + copy）
 *
 * 对标 openhanako 的 file 工具（STANDARD 分类）。
 * 提供 stat（查看元数据）和 copy（复制到工作区）两个 action。
 */

import { stat, copyFile } from 'fs/promises'
import path from 'path'

type ToolTextContent = { type: 'text'; text: string }
type ToolOutput = { content: ToolTextContent[] }

export interface FileArgs {
  action: 'stat' | 'copy'
  // stat 用
  path?: string
  // copy 用
  source?: string
  targetPath?: string
  targetDir?: string
  filename?: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export async function execute(args: FileArgs): Promise<ToolOutput> {
  const { action } = args

  if (action === 'stat') {
    const filePath = args.path
    if (!filePath) {
      return { content: [{ type: 'text', text: 'Error: path is required for stat action' }] }
    }

    let info: any
    try {
      info = await stat(filePath)
    } catch (e: any) {
      return { content: [{ type: 'text', text: `Error: Cannot stat ${filePath}: ${e.message}` }] }
    }

    const type = info.isDirectory() ? 'directory' : 'file'
    const lines = [
      `File: ${filePath}`,
      `Type: ${type}`,
      `Size: ${formatSize(info.size)}`,
      `Modified: ${info.mtime.toISOString()}`,
    ]
    return { content: [{ type: 'text', text: lines.join('\n') }] }
  }

  if (action === 'copy') {
    const source = args.source
    if (!source) {
      return { content: [{ type: 'text', text: 'Error: source is required for copy action' }] }
    }

    // 解析目标路径
    let targetPath: string
    if (args.targetPath) {
      targetPath = path.resolve(args.targetPath)
    } else if (args.targetDir) {
      const dir = path.resolve(args.targetDir)
      const name = args.filename || path.basename(source)
      targetPath = path.join(dir, name)
    } else {
      // 默认复制到当前工作目录
      targetPath = path.join(process.cwd(), path.basename(source))
    }

    try {
      await copyFile(source, targetPath)
      return {
        content: [{ type: 'text', text: `Copied ${source} to ${targetPath}` }],
      }
    } catch (e: any) {
      return { content: [{ type: 'text', text: `Error: Cannot copy ${source} to ${targetPath}: ${e.message}` }] }
    }
  }

  return {
    content: [{ type: 'text', text: `Error: Unknown action: ${action}. Supported: stat, copy` }],
  }
}

/**
 * stage-files-tool.ts — 文件暂存工具
 *
 * 对标 openhanako 的 stage_files 工具。
 * 将文件交付给用户/桌面/Bridge 平台。
 * 轻量实现：接受文件路径数组，验证存在性，返回交付结果。
 * 完整实现需要 SessionFile 子系统（后续补全）。
 */

import { stat } from 'fs/promises'
import path from 'path'

export interface StageFilesArgs {
  filepaths?: string[]
  fileIds?: string[]  // 兼容旧接口，暂未实现 SessionFile
  filePath?: string   // 兼容旧接口，单文件
  label?: string
}

interface StagedFile {
  filePath: string
  label: string
  size: number
  mime?: string
}

function guessMime(ext: string): string {
  const map: Record<string, string> = {
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.json': 'application/json',
    '.js':   'application/javascript',
    '.ts':   'application/typescript',
    '.tsx':  'application/typescript',
    '.html': 'text/html',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
  }
  return map[ext.toLowerCase()] || 'application/octet-stream'
}

export async function execute(args: StageFilesArgs): Promise<{ content: { type: 'text'; text: string }[]; details?: any }> {
  const results: StagedFile[] = []
  const errors: string[] = []

  // 收集所有文件路径
  let paths: string[] = []
  if (args.filepaths && args.filepaths.length > 0) {
    paths = args.filepaths
  } else if (args.filePath) {
    paths = [args.filePath]
  } else if (args.fileIds && args.fileIds.length > 0) {
    errors.push(`fileIds 暂未实现（需要 SessionFile 子系统）。请使用 filepaths 参数。`)
    return {
      content: [{ type: 'text', text: `Error: ${errors.join('; ')}` }],
    }
  }

  if (paths.length === 0) {
    return { content: [{ type: 'text', text: 'Error: filepaths 或 filePath 参数 required' }] }
  }

  for (const rawPath of paths) {
    const fp = rawPath.trim().replace(/^["']|["']$/g, '')
    if (!path.isAbsolute(fp)) {
      errors.push(`非绝对路径: ${fp}（stage_files 需要绝对路径）`)
      continue
    }

    let info: any
    try {
      info = await stat(fp)
    } catch (e: any) {
      errors.push(`文件不存在: ${fp} (${e.message})`)
      continue
    }

    if (info.isDirectory()) {
      errors.push(`跳过目录: ${fp}（stage_files 不支持目录）`)
      continue
    }

    const label = path.basename(fp)
    const ext = path.extname(fp).toLowerCase()
    results.push({
      filePath: fp,
      label,
      size: info.size,
      mime: guessMime(ext),
    })
  }

  if (results.length === 0) {
    return {
      content: [{ type: 'text', text: `Error: 没有可交付的文件。${errors.length > 0 ? errors.join('; ') : ''}` }],
    }
  }

  const summary = results.map(r => r.label).join(', ')
  let text = `已暂存 ${results.length} 个文件: ${summary}`
  if (errors.length > 0) {
    text += `\n\n警告: ${errors.join('; ')}`
  }

  return {
    content: [{ type: 'text', text }],
    details: {
      files: results,
      errors: errors.length > 0 ? errors : undefined,
    },
  }
}

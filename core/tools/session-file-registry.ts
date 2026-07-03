/**
 * session-file-registry.ts — 最小化 SessionFile 注册表
 *
 * 对齐 openhanako 的 SessionFile 子系统（最小化实现）。
 * 支持 registerSessionFile / resolveSessionFile。
 */

import { join } from 'path'
import { homedir } from 'os'
import { mkdir, writeFile, readFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'

interface SessionFileEntry {
  fileId: string
  sessionPath: string   // 所属 session 的 JSONL 路径
  filePath: string       // 实际文件路径
  label: string
  origin: string        // 来源：'tool_output' | 'install_skill_output' | etc.
  storageKind: string   // 'tool_output' | 'install_output' | etc.
  createdAt: number
}

const SESSION_FILE_DIR = join(homedir(), '.workbuddy', 'session-files')

// fileId → entry
const _registry = new Map<string, SessionFileEntry>()

// filePath → fileId（反向索引，用于去重）
const _pathToId = new Map<string, string>()

function generateFileId(): string {
  return `file_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * 注册一个 SessionFile。
 * 返回序列化后的 SessionFile 对象（含 fileId）。
 */
export async function registerSessionFile(opts: {
  sessionPath: string
  filePath: string
  label: string
  origin: string
  storageKind: string
}): Promise<{ fileId: string; filePath: string; label: string }> {
  // 去重：同一 filePath 只注册一次
  const existingId = _pathToId.get(opts.filePath)
  if (existingId) {
    const existing = _registry.get(existingId)
    if (existing) {
      return { fileId: existing.fileId, filePath: existing.filePath, label: existing.label }
    }
  }

  const fileId = generateFileId()
  const entry: SessionFileEntry = {
    fileId,
    sessionPath: opts.sessionPath,
    filePath: opts.filePath,
    label: opts.label,
    origin: opts.origin,
    storageKind: opts.storageKind,
    createdAt: Date.now(),
  }

  _registry.set(fileId, entry)
  _pathToId.set(opts.filePath, fileId)

  return { fileId, filePath: opts.filePath, label: opts.label }
}

/**
 * 根据 fileId 解析出文件路径。
 */
export function resolveSessionFile(fileId: string): { filePath: string } | null {
  const entry = _registry.get(fileId)
  if (!entry) return null
  return { filePath: entry.filePath }
}

/**
 * 根据 filePath 反向查找 fileId（用于工具返回已注册的文件引用）。
 */
export function getFileIdByPath(filePath: string): string | null {
  return _pathToId.get(filePath) || null
}

/**
 * 序列化 SessionFile 引用（供工具返回的 details 字段使用）。
 */
export function serializeSessionFile(result: { fileId: string; filePath: string; label: string }): {
  fileId: string
  label: string
  kind: string
} {
  return {
    fileId: result.fileId,
    label: result.label,
    kind: 'session_file',
  }
}

/**
 * 清理指定 session 的所有 SessionFile 记录（session 关闭时调用）。
 */
export function clearSessionFiles(sessionPath: string): void {
  for (const [fileId, entry] of _registry) {
    if (entry.sessionPath === sessionPath) {
      _pathToId.delete(entry.filePath)
      _registry.delete(fileId)
    }
  }
}

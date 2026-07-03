import { readFile, writeFile, stat, readdir } from 'fs/promises'
import { PathGuard } from './path-guard.js'

export interface FileReadResult {
  success: true
  content: string
  size: number
  mtime: string
}

export interface FileWriteResult {
  success: true
  bytesWritten: number
}

export interface FileStatResult {
  success: true
  size: number
  mtime: string
  isDirectory: boolean
}

export interface FileListResult {
  success: true
  entries: string[]
}

export type FileError = { success: false; error: string }

export function createFileTools(guard?: PathGuard) {
  return {
    /**
     * Read a file. Only works within allowed paths.
     */
    file_read: async ({ path }: { path: string }): Promise<FileReadResult | FileError> => {
      try {
        if (guard) guard.assertAllowed(path, 'read')
        const content = await readFile(path, 'utf-8')
        const info = await stat(path)
        return {
          success: true,
          content,
          size: info.size,
          mtime: info.mtime.toISOString(),
        }
      } catch (e: any) {
        return { success: false, error: e.message }
      }
    },

    /**
     * Write a file. Creates parent dirs if needed.
     */
    file_write: async ({ path, content }: { path: string; content: string }): Promise<FileWriteResult | FileError> => {
      try {
        if (guard) guard.assertAllowed(path, 'write')
        await writeFile(path, content, 'utf-8')
        return { success: true, bytesWritten: content.length }
      } catch (e: any) {
        return { success: false, error: e.message }
      }
    },

    /**
     * Get file/directory stats.
     */
    file_stat: async ({ path }: { path: string }): Promise<FileStatResult | FileError> => {
      try {
        if (guard) guard.assertAllowed(path, 'read')
        const info = await stat(path)
        return {
          success: true,
          size: info.size,
          mtime: info.mtime.toISOString(),
          isDirectory: info.isDirectory(),
        }
      } catch (e: any) {
        return { success: false, error: e.message }
      }
    },

    /**
     * List directory contents.
     */
    file_list: async ({ path }: { path: string }): Promise<FileListResult | FileError> => {
      try {
        if (guard) guard.assertAllowed(path, 'read')
        const entries = await readdir(path)
        return { success: true, entries }
      } catch (e: any) {
        return { success: false, error: e.message }
      }
    },
  }
}

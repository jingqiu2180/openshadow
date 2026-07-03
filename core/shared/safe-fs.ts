// safe-fs.ts — 安全文件系统操作（简化版）

import fs from 'fs'
import path from 'path'

/**
 * 原子写入文件（同步）
 * 先写临时文件，然后重命名
 * @param {string} filePath - 目标文件路径
 * @param {string} content - 文件内容
 */
export function atomicWriteSync(filePath, content) {
  const tmpPath = `${filePath}.tmp`
  try {
    // 写入临时文件
    fs.writeFileSync(tmpPath, content, 'utf8')
    // 重命名（原子操作）
    fs.renameSync(tmpPath, filePath)
  } catch (err) {
    // 清理临时文件
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath)
    }
    throw err
  }
}

/**
 * 安全读取文件（同步）
 * 如果文件不存在，返回 null
 * @param {string} filePath - 文件路径
 * @returns {string | null} 文件内容，或 null
 */
export function safeReadSync(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8')
    }
    return null
  } catch (err) {
    console.error(`[safe-fs] Failed to read ${filePath}:`, err.message)
    return null
  }
}

/**
 * 确保目录存在
 * @param {string} dirPath - 目录路径
 */
export function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

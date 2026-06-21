// @ts-nocheck
/**
 * debug-log.ts — 持久化调试日志
 * 移植自 openhanako/lib/debug-log.ts
 */
import fs from 'fs'
import path from 'path'
import os from 'os'
import { redactLogLabel, redactLogText } from './log-redactor.js'

class DebugLog {
  private _dedup: any
  private _filePath: string
  private _logDir: string
  private _redactOptions: any
  private _size: number
  private _truncated: boolean

  constructor(logDir: string) {
    fs.mkdirSync(logDir, { recursive: true })
    const now = new Date()
    const ts = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-') + '_' + [
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join('-')

    this._filePath = path.join(logDir, `${ts}.log`)
    this._logDir = logDir
    this._size = 0
    this._truncated = false
    this._redactOptions = { homeDir: os.homedir() }
    this._dedup = { level: null, module: null, msg: null, count: 0 }
    this._cleanup(7)
  }

  get filePath(): string { return this._filePath }

  header(version: string, info: any = {}): void {
    const lines = [
      '═'.repeat(60),
      `HanaAgent v${version} — started at ${new Date().toISOString()}`,
      '═'.repeat(60),
    ]
    if (info.model) lines.push(`Model: ${info.model}`)
    if (info.agent) lines.push(`Agent: ${info.agent} (${info.agentId || '?'})`)
    if (info.utilityModel) lines.push(`Utility: ${info.utilityModel}`)
    if (info.channelsDir) lines.push('Channels: configured')
    lines.push('─'.repeat(60), '')
    fs.appendFileSync(this._filePath, lines.map(line => redactLogText(line, this._redactOptions)).join('\n') + '\n', 'utf-8')
  }

  close(): void {
    this._flushDedup()
    this._write('INFO', 'system', 'Server shutting down')
    fs.appendFileSync(this._filePath, '\n' + '═'.repeat(60) + '\n', 'utf-8')
  }

  log(module: string, msg: string): void { this._write('INFO', module, msg) }
  error(module: string, msg: string): void { this._write('ERROR', module, msg) }
  warn(module: string, msg: string): void { this._write('WARN', module, msg) }

  tail(n = 100): string[] {
    try {
      const content = fs.readFileSync(this._filePath, 'utf-8')
      return content.split('\n').slice(-n)
    } catch {
      return []
    }
  }

  private _write(level: string, module: string, msg: string): void {
    const cleanModule = redactLogLabel(module || 'unknown')
    const cleaned = redactLogText(String(msg), this._redactOptions)
    const d = this._dedup
    if (d.level === level && d.module === cleanModule && d.msg === cleaned) {
      d.count++
      return
    }
    this._flushDedup()
    this._dedup = { level, module: cleanModule, msg: cleaned, count: 1 }
    this._append(level, cleanModule, cleaned)
  }

  private _flushDedup(): void {
    const d = this._dedup
    if (d.count > 1) {
      this._append('INFO', 'dedup', `⤷ 上条重复 ${d.count} 次`)
    }
    this._dedup = { level: null, module: null, msg: null, count: 0 }
  }

  private _append(level: string, module: string, msg: string): void {
    const MAX = 5 * 1024 * 1024
    if (this._truncated) return
    if (this._size >= MAX) {
      try {
        const notice = '\n[日志已达 5MB 上限，后续内容已截断]\n'
        fs.appendFileSync(this._filePath, notice, 'utf-8')
      } catch { /* ignore */ }
      this._truncated = true
      return
    }
    const now = new Date()
    const time = [
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join(':') + '.' + String(now.getMilliseconds()).padStart(3, '0')
    const line = `[${time}] [${level}] [${module}] ${msg}\n`
    try {
      fs.appendFileSync(this._filePath, line, 'utf-8')
      this._size += Buffer.byteLength(line, 'utf-8')
    } catch { /* ignore */ }
  }

  private _cleanup(maxDays: number): void {
    try {
      const cutoff = Date.now() - maxDays * 24 * 60 * 60 * 1000
      const files = fs.readdirSync(this._logDir).filter(f => f.endsWith('.log'))
      for (const f of files) {
        const filePath = path.join(this._logDir, f)
        const stat = fs.statSync(filePath)
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(filePath)
        }
      }
    } catch { /* ignore */ }
  }
}

let _instance: DebugLog | null = null

export function initDebugLog(logDir: string): DebugLog {
  _instance = new DebugLog(logDir)
  return _instance
}

export function debugLog(): DebugLog | null {
  return _instance
}

export function createModuleLogger(module: string) {
  const info = (msg: string) => {
    console.log(`[${module}] ${msg}`)
    _instance?.log(module, msg)
  }
  return {
    log: info,
    info,
    warn(msg: string) {
      console.warn(`[${module}] ${msg}`)
      _instance?.warn(module, msg)
    },
    error(msg: string) {
      console.error(`[${module}] ${msg}`)
      _instance?.error(module, msg)
    },
  }
}

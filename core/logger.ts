import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  timestamp: number
  level: LogLevel
  message: string
  context?: string
}

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

/**
 * Logger with file output and level filtering.
 */
export class Logger {
  private level: LogLevel
  private file?: string
  private context?: string

  constructor(options?: { level?: LogLevel; file?: string; context?: string }) {
    this.level = options?.level ?? 'info'
    this.file = options?.file
    this.context = options?.context
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVELS[level] >= LEVELS[this.level]
  }

  private format(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString()
    const ctx = this.context ? `[${this.context}]` : ''
    return `${timestamp} ${level.toUpperCase()} ${ctx} ${message}`
  }

  private write(entry: LogEntry): void {
    const line = JSON.stringify(entry) + '\n'

    if (this.file) {
      const dir = dirname(this.file)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      writeFileSync(this.file, line, { flag: 'a' })
    }
  }

  debug(message: string): void {
    if (this.shouldLog('debug')) {
      console.debug(this.format('debug', message))
      this.write({ timestamp: Date.now(), level: 'debug', message, context: this.context })
    }
  }

  info(message: string): void {
    if (this.shouldLog('info')) {
      console.log(this.format('info', message))
      this.write({ timestamp: Date.now(), level: 'info', message, context: this.context })
    }
  }

  warn(message: string): void {
    if (this.shouldLog('warn')) {
      console.warn(this.format('warn', message))
      this.write({ timestamp: Date.now(), level: 'warn', message, context: this.context })
    }
  }

  error(message: string, error?: Error): void {
    if (this.shouldLog('error')) {
      const fullMessage = error ? `${message}: ${error.message}` : message
      console.error(this.format('error', fullMessage))
      this.write({ timestamp: Date.now(), level: 'error', message: fullMessage, context: this.context })
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level
  }

  setContext(context: string): void {
    this.context = context
  }
}

export function createLogger(options?: { level?: LogLevel; file?: string; context?: string }): Logger {
  return new Logger(options)
}

export const logger = createLogger({ level: 'info' })
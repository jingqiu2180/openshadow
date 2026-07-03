/**
 * Server-side i18n — 从 locale JSON 加载翻译
 * 移植自 openhanako/lib/i18n.ts
 */
import fs from 'fs'
import path from 'path'

const localesDir = path.join(process.cwd(), 'locales')

let data: Record<string, any> = {}
// 英文兜底包：当前 locale 缺某个 key 时回退到这里
let fallbackData: Record<string, any> = {}
let currentLocale = 'zh'
let loaded = false

/**
 * locale 字符串 → JSON 文件名 key
 */
function resolveKey(locale: string): string {
  if (!locale) return 'zh'
  if (locale === 'zh-TW' || locale === 'zh-Hant') return 'zh-TW'
  if (locale.startsWith('zh')) return 'zh'
  if (locale.startsWith('ja')) return 'ja'
  if (locale.startsWith('ko')) return 'ko'
  return 'en'
}

function readLocaleFile(key: string): Record<string, any> {
  return JSON.parse(fs.readFileSync(path.join(localesDir, `${key}.json`), 'utf-8'))
}

export function loadLocale(locale: string): void {
  const key = resolveKey(locale)
  currentLocale = key
  loaded = true
  try {
    fallbackData = readLocaleFile('en')
  } catch (err: any) {
    console.error(`[i18n] Failed to load fallback locale "en": ${err.message}`)
    fallbackData = {}
  }
  if (key === 'en') {
    data = fallbackData
    return
  }
  try {
    data = readLocaleFile(key)
  } catch (err: any) {
    console.error(`[i18n] Failed to load locale "${key}": ${err.message}`)
    data = fallbackData
  }
}

function getFrom(source: any, p: string): any {
  const exact = source?.[p]
  if (exact !== undefined && exact !== null) return exact
  return p.split('.').reduce((obj, k) => obj?.[k], source)
}

function get(p: string): any {
  if (!loaded) loadLocale(currentLocale)
  const val = getFrom(data, p)
  if (val !== undefined && val !== null) return val
  return getFrom(fallbackData, p)
}

/**
 * 翻译
 */
export function t(path: string, vars?: Record<string, string>): string {
  let val: any = get(path)
  if (val === undefined || val === null) return path
  if (typeof val !== 'string') return String(val)
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      val = val.replaceAll(`{${k}}`, String(v))
    }
  }
  return val
}

export function getLocale(): string {
  return currentLocale
}

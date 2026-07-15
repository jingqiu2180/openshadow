/**
 * Main process i18n — 主进程国际化。
 *
 * 从 config.json 读取 locale，加载 desktop/src/locales/<locale>.json，
 * 提供 mt(key) 翻译函数给 main.cjs 使用。
 */

const fs = require('fs')
const path = require('path')

function createMainI18n({ openShadowHome, localesDir }) {
  let locale = 'zh-CN'
  let dict = {}

  function load() {
    try {
      const configPath = path.join(openShadowHome, 'config.json')
      if (fs.existsSync(configPath)) {
        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        locale = (cfg.ui && cfg.ui.language) || process.env.LC_MESSAGES || 'zh-CN'
      }
    } catch {}

    const filePath = path.join(localesDir, locale + '.json')
    try {
      if (fs.existsSync(filePath)) {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        dict = raw.main || raw || {}
      }
    } catch {}

    console.log(`[main-i18n] locale=${locale}, keys=${Object.keys(dict).length}`)
  }

  load()

  function mt(key, defaultValue) {
    const val = dict[key]
    if (val !== undefined) return val
    return defaultValue !== undefined ? defaultValue : key
  }

  function reset() {
    dict = {}
    load()
  }

  return { mt, reset }
}

module.exports = { createMainI18n }

// desktop/src/react/__tests__/bridge-ghost-global.test.ts
//
// 幽灵全局静态守卫：扫描源码，确保"window.openshadow"这类死 preload 暴露的幽灵全局
// 永远不会再被读取 / 暴露。我们 v0.4.5~v0.4.7 连踩 3 处同类回归（截图坏、输入框聚焦坏），
// 根因都是渲染层读了恒为 undefined 的 window.openshadow 而非真实 window.shadow。
// 此测试归入 npm run test:unit，能在 CI 中确定性阻断此类回归复发。

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// desktop/src/react/__tests__ -> desktop/
const DESKTOP_ROOT = join(__dirname, '..', '..', '..')

function walk(dir: string, exts: string[], out: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    if (
      name === 'node_modules' ||
      name === 'dist' ||
      name === 'dist-renderer' ||
      name === 'release' ||
      name === 'preload.bundle.cjs'
    ) {
      continue
    }
    const full = join(dir, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) walk(full, exts, out)
    else if (exts.some((e) => name.endsWith(e))) out.push(full)
  }
  return out
}

// 只匹配"基为 window / globalThis.window（可带 as _cast / 可选链）"的属性访问 .openshadow，
// 这样会排除：域名 relay.openshadow.example、状态数据键 ch1.openshadow、路径 /.openshadow/ 等合法用法。
const GHOST_RE =
  /(?:window|globalThis\.window)(?:\s+as\s+(?:any|unknown)(?:\s+as\s*\{[^}]*\})?)?\s*\)?\s*\?*\.\s*openshadow\b/
const EXPOSE_RE = /exposeInMainWorld\(\s*['"]openshadow['"]/

const SELF = __filename

describe('bridge ghost-global guard', () => {
  it('渲染层源码不得读取幽灵全局 window.openshadow', () => {
    const files = walk(join(DESKTOP_ROOT, 'src'), ['.ts', '.tsx'])
    const hits: string[] = []
    for (const f of files) {
      if (f === SELF) continue
      let text: string
      try {
        text = readFileSync(f, 'utf8')
      } catch {
        continue
      }
      if (GHOST_RE.test(text)) {
        const lines = text
          .split('\n')
          .map((l, i) => ({ l, i }))
          .filter(({ l }) => GHOST_RE.test(l))
          .map(({ l, i }) => `  L${i + 1}: ${l.trim()}`)
        hits.push(`${f}\n${lines.join('\n')}`)
      }
    }
    expect(hits, `发现 window.openshadow 读取:\n${hits.join('\n')}`).toEqual([])
  })

  it('desktop 下不得有任何 exposeInMainWorld("openshadow")', () => {
    const files = walk(DESKTOP_ROOT, ['.cjs', '.js']).filter((f) => f !== SELF)
    const hits: string[] = []
    for (const f of files) {
      let text: string
      try {
        text = readFileSync(f, 'utf8')
      } catch {
        continue
      }
      if (EXPOSE_RE.test(text)) hits.push(f)
    }
    expect(hits, `发现 exposeInMainWorld("openshadow"):\n${hits.join('\n')}`).toEqual([])
  })
})

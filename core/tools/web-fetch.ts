// @ts-nocheck
/**
 * web-fetch.ts — 增强版 web_fetch 工具
 *
 * 抓取指定 URL 的内容并提取文本。
 * 支持：HTML 页面（转 Markdown/纯文本）、JSON API、纯文本
 * 安全：SSRF 防护（禁止内网 IP）、重定向跟踪、超时控制
 */

import { lookup } from 'dns/promises'
import { isIP } from 'net'
import { URL } from 'url'

const MAX_CONTENT_LENGTH = 12000
const FETCH_TIMEOUT = 15000
const MAX_REDIRECTS = 5

// RFC 1918 / RFC 4193 / loopback / link-local 等私有地址段
const PRIVATE_IP_RANGES = [
  /^127\./,
  /^::1$/,
  /^0\.0\.0\.0$/,
  /^0:0:0:0:0:0:0:1$/,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^fe80:/i,
  /^fc00:/i,
  /^fd[0-9a-f]{2}:/i,
]

async function isPrivateHost(hostname: string): Promise<boolean> {
  if (isIP(hostname)) return PRIVATE_IP_RANGES.some(r => r.test(hostname))
  try {
    const results = await lookup(hostname, { all: true })
    if (results.length === 0) return true
    return results.some(r => PRIVATE_IP_RANGES.some(pat => pat.test(r.address)))
  } catch {
    return true // DNS 解析失败，保守拒绝
  }
}

// ── HTML → 文本（简易版，不依赖外部库）─────────────

function htmlToText(html: string): string {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')

  // 块级标签换行
  text = text.replace(/<\/?(p|div|br|h[1-6]|li|tr|blockquote|section|article|header)[^>]*>/gi, '\n')

  // 保留链接
  text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')

  // 去掉剩余标签
  text = text.replace(/<[^>]+>/g, '')

  // HTML 实体
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(+n))

  // 合并空白
  text = text.replace(/[ \t]+/g, ' ')
  text = text.replace(/\n{3,}/g, '\n\n')

  return text.trim()
}

// ── 工具注册 ─────────────────────────────────────────────

export function registerWebFetchTool(registry: any): void {
  registry.register({
    name: 'web_fetch',
    description: '抓取指定 URL 的内容并提取文本。适用于阅读网页文章、技术文档、API 响应等。与 web_search 配合使用：先搜索找到 URL，再用本工具读取完整内容。',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '要抓取的完整 URL（必须包含 https:// 或 http://）' },
        maxLength: { type: 'number', description: `返回最大字符数，默认 ${MAX_CONTENT_LENGTH}`, default: MAX_CONTENT_LENGTH },
      },
      required: ['url'],
    },
    execute: async (args: any) => {
      const url = args.url?.trim()
      if (!url) return { content: [{ type: 'text', text: '错误：URL 不能为空。' }] }

      // URL 基础校验
      let parsedUrl: URL
      try {
        parsedUrl = new URL(url)
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          return { content: [{ type: 'text', text: '错误：只支持 HTTP/HTTPS 协议。' }] }
        }
      } catch {
        return { content: [{ type: 'text', text: `错误：无效的 URL：${url}` }] }
      }

      try {
        // SSRF 防护：逐跳校验 hostname
        let currentUrl = url
        let res: Response | null = null

        for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
          const hopParsed = new URL(currentUrl)
          if (await isPrivateHost(hopParsed.hostname)) {
            return { content: [{ type: 'text', text: `安全拦截：禁止访问内网地址 ${hopParsed.hostname}。` }] }
          }

          res = await fetch(currentUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; RemuAgentBot/1.0)',
              'Accept': 'text/html,application/xhtml+xml,application/json,text/plain,*/*',
              'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            },
            redirect: 'manual',
            signal: AbortSignal.timeout(FETCH_TIMEOUT),
          })

          if ([301, 302, 307, 308].includes(res.status)) {
            const location = res.headers.get('location')
            if (!location) break
            currentUrl = new URL(location, currentUrl).href
            continue
          }
          break
        }

        if (!res || [301, 302, 307, 308].includes(res.status)) {
          return { content: [{ type: 'text', text: `错误：重定向次数超过限制（${MAX_REDIRECTS} 次）。` }] }
        }

        if (!res.ok) {
          return { content: [{ type: 'text', text: `HTTP 错误：${res.status} ${res.statusText}` }] }
        }

        const contentType = res.headers.get('content-type') || ''
        const raw = await res.text()
        const maxLen = args.maxLength ?? MAX_CONTENT_LENGTH

        let text: string
        let format: string

        if (contentType.includes('application/json')) {
          try {
            const obj = JSON.parse(raw)
            text = JSON.stringify(obj, null, 2)
          } catch {
            text = raw
          }
          format = 'json'
        } else if (contentType.includes('text/html')) {
          // 优先尝试转 Markdown（如果安装了 html-to-markdown）
          text = htmlToText(raw)
          format = 'html→text'
        } else {
          text = raw
          format = 'text'
        }

        const truncated = text.length > maxLen
        if (truncated) {
          text = text.slice(0, maxLen) + `\n\n[内容已截断，原文共 ${text.length} 字符]`
        }

        const finalUrl = new URL(currentUrl)
        const header = `来源：${finalUrl.hostname}${finalUrl.pathname}（格式：${format}）\n\n`

        return { content: [{ type: 'text', text: header + text }] }
      } catch (err) {
        const msg = err instanceof Error && err.name === 'TimeoutError'
          ? `抓取超时（${FETCH_TIMEOUT / 1000} 秒）：${url}`
          : `抓取出错：${err instanceof Error ? err.message : String(err)}`
        return { content: [{ type: 'text', text: msg }] }
      }
    },
  })
}

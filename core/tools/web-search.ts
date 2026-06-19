// @ts-nocheck
/**
 * web-search.ts — 增强版 web_search 工具
 *
 * 支持多 provider：Tavily / Serper / Brave / AnySearch free / browser
 * 自动 fallback：配置 API key → 用对应 provider；否则用 AnySearch free → browser
 */

import fs from 'fs'

const DEFAULT_SEARCH_PROVIDER = 'anysearch_free'
const ANYSEARCH_FREE_PROVIDER = 'anysearch_free'
const ANYSEARCH_SEARCH_URL = 'https://api.anysearch.com/v1/search'
const DEFAULT_DISPLAY_RESULTS = 10
const ANYSEARCH_DEFAULT_RESULTS = 20
const ANYSEARCH_MAX_RESULTS = 100
const TAVILY_MAX_RESULTS = 20
const BROWSER_MAX_RESULTS = 10

// ── 工具定义（给 ToolRegistry 用）──────────────────────────
export interface SearchResult {
  title: string
  url: string
  snippet: string
}

/**
 * 从 config.yaml 读取搜索配置
 */
function loadSearchConfig(configPath?: string): Record<string, any> {
  if (!configPath) return {}
  try {
    const yaml = require('yaml')
    const content = fs.readFileSync(configPath, 'utf8')
    return yaml.parse(content) || {}
  } catch {
    return {}
  }
}

function clampResults(maxResults: number, { defaultValue, max, min = 1 }: { defaultValue: number; max: number; min?: number }): number {
  const value = Number(maxResults)
  if (!Number.isFinite(value)) return defaultValue
  return Math.min(max, Math.max(min, Math.floor(value)))
}

function maxResultsForProvider(provider: string, maxResults: number): number {
  if (provider === ANYSEARCH_FREE_PROVIDER) {
    return clampResults(maxResults, { defaultValue: ANYSEARCH_DEFAULT_RESULTS, max: ANYSEARCH_MAX_RESULTS })
  }
  if (provider === 'tavily') {
    return clampResults(maxResults, { defaultValue: 10, max: TAVILY_MAX_RESULTS })
  }
  if (['baidu', 'google_browser'].includes(provider)) {
    return clampResults(maxResults, { defaultValue: DEFAULT_DISPLAY_RESULTS, max: BROWSER_MAX_RESULTS })
  }
  return clampResults(maxResults, { defaultValue: 10, max: DEFAULT_DISPLAY_RESULTS })
}

// ── Provider 实现 ──────────────────────────────────────────

async function searchTavily(query: string, maxResults: number, apiKey: string): Promise<SearchResult[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, max_results: maxResults, search_depth: 'basic' }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`Tavily API ${res.status}`)
  const data = await res.json() as any
  return (data.results || []).map((r: any) => ({
    title: r.title || '',
    url: r.url || '',
    snippet: r.content || '',
  }))
}

async function searchSerper(query: string, maxResults: number, apiKey: string): Promise<SearchResult[]> {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
    },
    body: JSON.stringify({ q: query, num: maxResults }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`Serper API ${res.status}`)
  const data = await res.json() as any
  return (data.organic || []).slice(0, maxResults).map((r: any) => ({
    title: r.title || '',
    url: r.link || '',
    snippet: r.snippet || '',
  }))
}

async function searchBrave(query: string, maxResults: number, apiKey: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query, count: String(maxResults) })
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    headers: {
      'Accept': 'application/json',
      'X-Subscription-Token': apiKey,
    },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`Brave API ${res.status}`)
  const data = await res.json() as any
  return (data.web?.results || []).slice(0, maxResults).map((r: any) => ({
    title: r.title || '',
    url: r.url || '',
    snippet: r.description || '',
  }))
}

async function searchAnySearchFree(query: string, maxResults: number): Promise<SearchResult[]> {
  const resultLimit = maxResultsForProvider(ANYSEARCH_FREE_PROVIDER, maxResults)
  const res = await fetch(ANYSEARCH_SEARCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      max_results: resultLimit,
      language: 'zh-CN',
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`AnySearch API ${res.status}`)
  const data = await res.json() as any
  const results = data?.data?.results || data?.results || []
  return results.slice(0, resultLimit).map((r: any) => ({
    title: r.title || '',
    url: r.url || '',
    snippet: r.content || r.description || r.snippet || '',
  }))
}

// ── 统一搜索入口 ─────────────────────────────────────────

async function doSearch(query: string, maxResults = DEFAULT_DISPLAY_RESULTS, configPath?: string): Promise<{ results: SearchResult[]; provider: string }> {
  const config = loadSearchConfig(configPath)
  const searchConfig = config.search || {}
  const provider = searchConfig.provider || DEFAULT_SEARCH_PROVIDER
  const apiKeys: Record<string, string> = searchConfig.api_keys || {}
  // 兼容单 key 配置
  if (typeof searchConfig.api_key === 'string' && searchConfig.api_key.trim()) {
    // 根据 provider 填入对应 key
    if (provider !== ANYSEARCH_FREE_PROVIDER) {
      apiKeys[provider] = apiKeys[provider] || searchConfig.api_key.trim()
    }
  }

  if (provider === DEFAULT_SEARCH_PROVIDER || provider === ANYSEARCH_FREE_PROVIDER) {
    // auto 模式：依次尝试有 key 的 provider → anysearch free
    const apiProviders = ['tavily', 'serper', 'brave'].filter(p => !!apiKeys[p])
    const chain = [...apiProviders, ANYSEARCH_FREE_PROVIDER]
    for (const p of chain) {
      try {
        const mr = maxResultsForProvider(p, maxResults)
        let results: SearchResult[]
        if (p === ANYSEARCH_FREE_PROVIDER) {
          results = await searchAnySearchFree(query, mr)
        } else {
          results = await (p === 'tavily' ? searchTavily : p === 'serper' ? searchSerper : searchBrave)(query, mr, apiKeys[p])
        }
        if (results.length > 0) return { results, provider: p }
      } catch (err) {
        // 继续尝试下一个
        continue
      }
    }
    return { results: [], provider: DEFAULT_SEARCH_PROVIDER }
  }

  // 指定 provider
  const mr = maxResultsForProvider(provider, maxResults)
  let results: SearchResult[]
  if (provider === 'tavily') results = await searchTavily(query, mr, apiKeys[provider] || '')
  else if (provider === 'serper') results = await searchSerper(query, mr, apiKeys[provider] || '')
  else if (provider === 'brave') results = await searchBrave(query, mr, apiKeys[provider] || '')
  else results = await searchAnySearchFree(query, mr)

  return { results, provider }
}

// ── 工具注册 ──────────────────────────────────────────────

export function registerWebSearchTool(registry: any, configPath?: string): void {
  registry.register({
    name: 'web_search',
    description: '搜索互联网获取实时信息。当需要最新新闻、技术文档、当前事件或任何外部知识时使用。支持中英文搜索。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
        maxResults: { type: 'number', description: '返回结果数量，默认 10', default: DEFAULT_DISPLAY_RESULTS },
      },
      required: ['query'],
    },
    execute: async (args: any) => {
      const query = args.query?.trim()
      if (!query) return { content: [{ type: 'text', text: '错误：搜索关键词不能为空。' }] }

      try {
        const { results, provider } = await doSearch(query, args.maxResults || DEFAULT_DISPLAY_RESULTS, configPath)
        if (results.length === 0) {
          return { content: [{ type: 'text', text: `搜索失败：所有 provider 均未返回结果。请检查搜索配置或网络连通性。` }] }
        }
        const displayLimit = clampResults(args.maxResults || DEFAULT_DISPLAY_RESULTS, { defaultValue: DEFAULT_DISPLAY_RESULTS, max: ANYSEARCH_MAX_RESULTS })
        const formatted = results.slice(0, displayLimit).map((r, i) =>
          `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`
        ).join('\n\n')
        return { content: [{ type: 'text', text: `搜索结果（provider: ${provider}）：\n\n${formatted}` }] }
      } catch (err) {
        return { content: [{ type: 'text', text: `搜索出错：${err instanceof Error ? err.message : String(err)}` }] }
      }
    },
  })
}

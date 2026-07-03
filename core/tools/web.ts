// Use global fetch (Node 18+)

export interface WebSearchResult {
  success: true
  results: Array<{ title: string; url: string; snippet: string }>
}

export interface WebFetchResult {
  success: true
  content: string
  url: string
}

export type WebError = { success: false; error: string }
export type WebOutput = WebSearchResult | WebFetchResult | WebError

export async function webSearch(query: string, count: number = 5): Promise<WebSearchResult | WebError> {
  try {
    const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`
    const res = await fetch(url)
    const text = await res.text()

    const titles: string[] = []
    const regex = /<a class="result__a"[^>]*>([^<]+)<\/a>/g
    let match
    while ((match = regex.exec(text)) && titles.length < count) {
      titles.push(match[1])
    }

    return {
      success: true,
      results: titles.map((title, i) => ({ title, url: `#${i + 1}`, snippet: title })),
    }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function webFetch(url: string, maxChars: number = 10000): Promise<WebFetchResult | WebError> {
  try {
    const res = await fetch(url)
    const text = await res.text()

    const cleaned = text
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '\n')
      .replace(/\n{2,}/g, '\n')
      .slice(0, maxChars)

    return { success: true, content: cleaned, url }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export function createWebTools() {
  return { web_search: webSearch, web_fetch: webFetch }
}
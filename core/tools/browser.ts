// @ts-nocheck
/**
 * Browser automation tools — dual mode:
 *
 * 1. **Electron webview mode** (preferred): When running inside Electron,
 *    browser operations go through IPC → main process → BrowserPanel (webview).
 *    This gives the user a visible, interactive browser inside the app.
 *
 * 2. **Playwright fallback**: When running in CLI/server mode (no Electron),
 *    falls back to Playwright's headless Chromium.
 */

import { chromium, Browser, Page, BrowserContext } from '@playwright/test'

// ─── Shared types ──────────────────────────────────────────────────────

export interface BrowserInstance {
  id: string
  browser: Browser | null       // null in webview mode
  context: BrowserContext | null // null in webview mode
  page: Page | null             // null in webview mode
  mode: 'webview' | 'playwright'
  createdAt: number
}

export interface NavigateOptions {
  url: string
  browserId?: string
  headless?: boolean
  viewport?: { width: number; height: number }
}

export interface ElementClickOptions {
  selector: string
  browserId?: string
  button?: 'left' | 'right' | 'double'
  timeout?: number
}

export interface ElementTypeOptions {
  selector: string
  text: string
  browserId?: string
  pressEnter?: boolean
}

export interface ScreenshotOptions {
  browserId?: string
  fullPage?: boolean
}

const instances = new Map<string, BrowserInstance>()
let defaultId = 'default'

// ─── Electron IPC detection ────────────────────────────────────────────

function isElectronBrowserAvailable(): boolean {
  return typeof globalThis !== 'undefined'
    && !!(globalThis as any).__REM_API__?.browserCreate
}

async function browserIpc(method: string, ...args: any[]): Promise<any> {
  const api = (globalThis as any).__REM_API__
  if (!api) throw new Error('Electron browser API not available')
  const fn = api[method]
  if (typeof fn !== 'function') throw new Error(`Electron browser method not found: ${method}`)
  return fn(...args)
}

// ─── Browser lifecycle ──────────────────────────────────────────────────

export async function browserNew(options: NavigateOptions): Promise<{
  success: true
  id: string
  url: string
  title: string
} | { success: false; error: string }> {
  const id = options.browserId ?? defaultId

  // Close existing instance if any
  await browserClose(id)

  // ─── Electron webview mode ────────────────────────────────────────
  if (isElectronBrowserAvailable()) {
    try {
      const result = await browserIpc('browserCreate', options.url || 'about:blank')
      instances.set(id, {
        id,
        browser: null,
        context: null,
        page: null,
        mode: 'webview',
        createdAt: Date.now(),
      })
      return {
        success: true,
        id,
        url: options.url || 'about:blank',
        title: result?.title ?? '',
      }
    } catch (e: any) {
      // Fall through to Playwright
      console.warn('[browser] Electron webview failed, falling back to Playwright:', e.message)
    }
  }

  // ─── Playwright fallback ──────────────────────────────────────────
  try {
    const browser = await chromium.launch({
      headless: options.headless ?? true,
    })

    const context = await browser.newContext({
      viewport: options.viewport ?? { width: 1920, height: 1080 },
    })

    const page = await context.newPage()

    if (options.url) {
      await page.goto(options.url, { waitUntil: 'networkidle', timeout: 30000 })
    }

    instances.set(id, {
      id,
      browser,
      context,
      page,
      mode: 'playwright',
      createdAt: Date.now(),
    })

    const title = await page.title()
    return { success: true, id, url: options.url, title }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function browserClose(id?: string): Promise<{ success: true } | { success: false; error: string }> {
  const targetId = id ?? defaultId
  const inst = instances.get(targetId)
  if (!inst) return { success: true }

  try {
    if (inst.mode === 'webview') {
      await browserIpc('browserClose').catch(() => {})
    } else {
      if (inst.context) await inst.context.close()
      if (inst.browser) await inst.browser.close()
    }
    instances.delete(targetId)
  } catch (e: any) {
    return { success: false, error: e.message }
  }
  return { success: true }
}

// ─── Navigation ─────────────────────────────────────────────────────────

export async function browserNavigate(url: string, id?: string): Promise<{
  success: true
  url: string
  title: string
} | { success: false; error: string }> {
  const inst = instances.get(id ?? defaultId)
  if (!inst) return { success: false, error: `Browser ${id ?? defaultId} not open. Use browser_new first.` }

  if (inst.mode === 'webview') {
    try {
      const result = await browserIpc('browserNavigate', url)
      return { success: true, url, title: result?.title ?? '' }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }

  // Playwright
  try {
    await inst.page!.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    const title = await inst.page!.title()
    return { success: true, url, title }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ─── Screenshot ─────────────────────────────────────────────────────────

export async function browserScreenshot(opts?: ScreenshotOptions): Promise<{
  success: true
  base64: string
  width: number
  height: number
} | { success: false; error: string }> {
  const inst = instances.get(opts?.browserId ?? defaultId)
  if (!inst) return { success: false, error: `Browser not open. Use browser_new first.` }

  if (inst.mode === 'webview') {
    try {
      const result = await browserIpc('browserScreenshot')
      return {
        success: true,
        base64: result.base64,
        width: result.width ?? 1920,
        height: result.height ?? 1080,
      }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }

  // Playwright
  try {
    const buffer = await inst.page!.screenshot({
      fullPage: opts?.fullPage ?? false,
      type: 'png',
    })
    const base64 = buffer.toString('base64')
    const bbox = inst.page!.viewportSize()
    return {
      success: true,
      base64,
      width: bbox?.width ?? 1920,
      height: bbox?.height ?? 1080,
    }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ─── Click ──────────────────────────────────────────────────────────────

export async function browserClick(selector: string, id?: string): Promise<{
  success: true
  element: string
} | { success: false; error: string }> {
  const inst = instances.get(id ?? defaultId)
  if (!inst) return { success: false, error: `Browser not open` }

  if (inst.mode === 'webview') {
    try {
      await browserIpc('browserClick', selector)
      return { success: true, element: selector }
    } catch (e: any) {
      return { success: false, error: `Click failed: ${e.message}` }
    }
  }

  try {
    await inst.page!.click(selector, { timeout: 10000 })
    return { success: true, element: selector }
  } catch (e: any) {
    return { success: false, error: `Click failed: ${e.message}` }
  }
}

// ─── Type ───────────────────────────────────────────────────────────────

export async function browserType(text: string, selector: string | null, id?: string): Promise<{
  success: true
  text: string
} | { success: false; error: string }> {
  const inst = instances.get(id ?? defaultId)
  if (!inst) return { success: false, error: `Browser not open` }

  if (inst.mode === 'webview') {
    try {
      if (selector) {
        await browserIpc('browserType', selector, text)
      } else {
        await browserIpc('browserPressKey', text)
      }
      return { success: true, text }
    } catch (e: any) {
      return { success: false, error: `Type failed: ${e.message}` }
    }
  }

  try {
    if (selector) {
      await inst.page!.fill(selector, text)
    } else {
      await inst.page!.keyboard.type(text)
    }
    return { success: true, text }
  } catch (e: any) {
    return { success: false, error: `Type failed: ${e.message}` }
  }
}

// ─── Press key ──────────────────────────────────────────────────────────

export async function browserPressKey(key: string, id?: string): Promise<{
  success: true
} | { success: false; error: string }> {
  const inst = instances.get(id ?? defaultId)
  if (!inst) return { success: false, error: `Browser not open` }

  if (inst.mode === 'webview') {
    try {
      await browserIpc('browserPressKey', key)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }

  try {
    await inst.page!.keyboard.press(key)
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ─── Get text ───────────────────────────────────────────────────────────

export async function browserGetText(selector: string, id?: string): Promise<{
  success: true
  text: string
} | { success: false; error: string }> {
  const inst = instances.get(id ?? defaultId)
  if (!inst) return { success: false, error: `Browser not open` }

  if (inst.mode === 'webview') {
    try {
      const result = await browserIpc('browserGetText', selector)
      return { success: true, text: result?.text ?? '' }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }

  try {
    const text = await inst.page!.textContent(selector) ?? ''
    return { success: true, text }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ─── Get HTML ───────────────────────────────────────────────────────────

export async function browserGetHtml(id?: string): Promise<{
  success: true
  html: string
} | { success: false; error: string }> {
  const inst = instances.get(id ?? defaultId)
  if (!inst) return { success: false, error: `Browser not open` }

  if (inst.mode === 'webview') {
    try {
      const result = await browserIpc('browserGetHtml')
      return { success: true, html: result?.html ?? '' }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }

  try {
    const html = await inst.page!.content()
    return { success: true, html: html.slice(0, 5000) }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ─── Wait for selector ─────────────────────────────────────────────────

export async function browserWaitForSelector(selector: string, timeout = 10000, id?: string): Promise<{
  success: true
} | { success: false; error: string }> {
  const inst = instances.get(id ?? defaultId)
  if (!inst) return { success: false, error: `Browser not open` }

  if (inst.mode === 'webview') {
    try {
      await browserIpc('browserWaitFor', selector, timeout)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: `Wait timed out: ${e.message}` }
    }
  }

  try {
    await inst.page!.waitForSelector(selector, { timeout })
    return { success: true }
  } catch (e: any) {
    return { success: false, error: `Wait timed out: ${e.message}` }
  }
}

// ─── Utils ──────────────────────────────────────────────────────────────

export function listBrowserInstances(): string[] {
  return [...instances.keys()]
}

export function createBrowserTools() {
  return {
    browser_new: browserNew,
    browser_close: browserClose,
    browser_navigate: browserNavigate,
    browser_screenshot: browserScreenshot,
    browser_click: browserClick,
    browser_type: browserType,
    browser_press_key: browserPressKey,
    browser_get_text: browserGetText,
    browser_get_html: browserGetHtml,
    browser_wait: browserWaitForSelector,
  }
}

export { browserNew as _new, browserClose as _close }

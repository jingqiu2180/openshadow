/**
 * Browser automation tools using Playwright.
 * Enables Agent to control web browsers: navigate, click, type, screenshot.
 */

import { chromium, Browser, Page, BrowserContext } from '@playwright/test'

export interface BrowserInstance {
  id: string
  browser: Browser
  context: BrowserContext
  page: Page
  createdAt: number
}

const instances = new Map<string, BrowserInstance>()
let defaultId = 'default'

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

// ─── Browser lifecycle ────────────────────────────────────────────────────────

export async function browserNew(options: NavigateOptions): Promise<{
  success: true
  id: string
  url: string
  title: string
} | { success: false; error: string }> {
  const id = options.browserId ?? defaultId

  // Close existing if any
  await browserClose(id)

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
    await inst.context.close()
    await inst.browser.close()
    instances.delete(targetId)
  } catch (e: any) {
    return { success: false, error: e.message }
  }
  return { success: true }
}

export async function browserNavigate(url: string, id?: string): Promise<{
  success: true
  url: string
  title: string
} | { success: false; error: string }> {
  const inst = instances.get(id ?? defaultId)
  if (!inst) return { success: false, error: `Browser ${id ?? defaultId} not open. Use browser_new first.` }

  try {
    await inst.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    const title = await inst.page.title()
    return { success: true, url, title }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function browserScreenshot(opts?: ScreenshotOptions): Promise<{
  success: true
  base64: string
  width: number
  height: number
} | { success: false; error: string }> {
  const inst = instances.get(opts?.browserId ?? defaultId)
  if (!inst) return { success: false, error: `Browser not open. Use browser_new first.` }

  try {
    const buffer = await inst.page.screenshot({
      fullPage: opts?.fullPage ?? false,
      type: 'png',
    })
    const base64 = buffer.toString('base64')
    const bbox = inst.page.viewportSize()
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

export async function browserClick(selector: string, id?: string): Promise<{
  success: true
  element: string
} | { success: false; error: string }> {
  const inst = instances.get(id ?? defaultId)
  if (!inst) return { success: false, error: `Browser not open` }

  try {
    await inst.page.click(selector, { timeout: 10000 })
    return { success: true, element: selector }
  } catch (e: any) {
    return { success: false, error: `Click failed: ${e.message}` }
  }
}

export async function browserType(text: string, selector: string | null, id?: string): Promise<{
  success: true
  text: string
} | { success: false; error: string }> {
  const inst = instances.get(id ?? defaultId)
  if (!inst) return { success: false, error: `Browser not open` }

  try {
    if (selector) {
      await inst.page.fill(selector, text)
    } else {
      await inst.page.keyboard.type(text)
    }
    return { success: true, text }
  } catch (e: any) {
    return { success: false, error: `Type failed: ${e.message}` }
  }
}

export async function browserPressKey(key: string, id?: string): Promise<{
  success: true
} | { success: false; error: string }> {
  const inst = instances.get(id ?? defaultId)
  if (!inst) return { success: false, error: `Browser not open` }

  try {
    await inst.page.keyboard.press(key)
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function browserGetText(selector: string, id?: string): Promise<{
  success: true
  text: string
} | { success: false; error: string }> {
  const inst = instances.get(id ?? defaultId)
  if (!inst) return { success: false, error: `Browser not open` }

  try {
    const text = await inst.page.textContent(selector) ?? ''
    return { success: true, text }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function browserGetHtml(id?: string): Promise<{
  success: true
  html: string
} | { success: false; error: string }> {
  const inst = instances.get(id ?? defaultId)
  if (!inst) return { success: false, error: `Browser not open` }

  try {
    const html = await inst.page.content()
    return { success: true, html: html.slice(0, 5000) }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function browserWaitForSelector(selector: string, timeout = 10000, id?: string): Promise<{
  success: true
} | { success: false; error: string }> {
  const inst = instances.get(id ?? defaultId)
  if (!inst) return { success: false, error: `Browser not open` }

  try {
    await inst.page.waitForSelector(selector, { timeout })
    return { success: true }
  } catch (e: any) {
    return { success: false, error: `Wait timed out: ${e.message}` }
  }
}

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
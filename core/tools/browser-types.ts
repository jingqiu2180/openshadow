// @ts-nocheck
/**
 * Browser tools — Electron webview mode.
 *
 * When running inside Electron, browser operations go through IPC:
 *   renderer (webview) → preload bridge → main process → core/tools
 *
 * When running in CLI/server mode, falls back to Playwright.
 *
 * The webview lives in BrowserPanel.tsx (renderer).
 * The main process manages webview state via ipcMain handlers.
 */

// ─── Types shared between main/renderer/core ──────────────────────────

export interface BrowserTab {
  id: string
  url: string
  title: string
  createdAt: number
}

export interface BrowserActionResult {
  success: boolean
  error?: string
  data?: any
}

/** Messages sent from main → renderer to control the webview */
export type WebviewCommand =
  | { type: 'navigate'; url: string }
  | { type: 'goBack' }
  | { type: 'goForward' }
  | { type: 'reload' }
  | { type: 'screenshot' }
  | { type: 'click'; selector: string }
  | { type: 'type'; selector: string; text: string }
  | { type: 'pressKey'; key: string }
  | { type: 'getText'; selector: string }
  | { type: 'getHtml' }
  | { type: 'waitForSelector'; selector: string; timeout: number }
  | { type: 'close' }

/** Responses from renderer → main after webview commands */
export interface WebviewResponse {
  success: boolean
  data?: any
  error?: string
}

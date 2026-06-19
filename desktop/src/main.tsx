// @ts-nocheck
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/global.css'
import './styles/themes/cool-night.css'
import './styles/themes/auto.css'

// Stage 1d: apply theme with server-first / localStorage-fallback
// We try server first (authoritative), fall back to localStorage if dev
// server isn't up, and apply synchronously to avoid FOUC.
const THEME_KEY = 'rem.theme'
function applyThemeSync() {
  const cached = localStorage.getItem(THEME_KEY) ?? 'warm-paper'
  document.documentElement.setAttribute('data-theme', cached)
}
async function applyThemeFromServer() {
  // Apply cached first to avoid FOUC, then upgrade from server
  applyThemeSync()
  try {
    const res = await fetch('http://localhost:3000/api/config/theme')
    if (res.ok) {
      const { theme } = await res.json()
      if (theme) {
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.setItem(THEME_KEY, theme)
      }
    }
  } catch (e) {
    // Server not up — localStorage value (or default) wins
  }
}
applyThemeFromServer()

// ── i18n 初始化 ──
declare global {
  const i18n: { locale: string; load(locale: string): Promise<void> }
  const t: (key: string, vars?: Record<string, string | number>) => string
}
async function initI18n() {
  const locale = navigator.language || 'zh'
  try {
    await window.i18n?.load?.(locale)
    console.log(`[i18n] Loaded locale: ${locale}`)
  } catch (e) {
    console.warn('[i18n] Failed to load locale:', e)
  }
}

const rootEl = document.getElementById('react-root')
if (rootEl) {
  // 先初始化 i18n，完成后再渲染 React
  initI18n().then(() => {
    createRoot(rootEl).render(<App />)
  })
}

/**
 * desktop/theme-controller.cjs
 *
 * 主题切换 IPC 控制器：维护一份 <themeName, bgColor> 表，
 * 创窗口时用 setBackgroundColor，主题变化时把新背景色同步给所有打开的 BrowserWindow。
 *
 * 学自 Lynn/settings-onboarding-controller.cjs 的 themeBg 模式
 * （见原文件 489-495 行）。
 */

const THEME_BG = {
  "warm-paper": "#F8F5ED",
  "midnight": "#2D4356",
  "high-contrast": "#FAF9F6",
  "grass-aroma": "#F5F8F3",
  "contemplation": "#F3F5F7",
  "deep-think": "#1A1A1A",
  "absolutely": "#FFFFFF",
  "delve": "#262624",
  "new-warm-paper": "#FAF7F0",
}

function bgFor(themeName) {
  return THEME_BG[themeName] || "#F8F5ED"
}

function createThemeController({ BrowserWindow, nativeTheme, getMainWindow, getSettingsWindow, getBrowserViewer }) {
  let currentTheme = "warm-paper"

  function resolveAuto() {
    return nativeTheme?.shouldUseDarkColors ? "midnight" : "warm-paper"
  }

  function applyToWindow(win, themeName) {
    if (!win || win.isDestroyed()) return
    win.setBackgroundColor(bgFor(themeName))
  }

  function applyToAll(themeName) {
    const resolved = themeName === "auto" ? resolveAuto() : themeName
    currentTheme = resolved
    const wins = [getMainWindow && getMainWindow(), getSettingsWindow && getSettingsWindow()]
    for (const w of wins) applyToWindow(w, resolved)
    const viewer = getBrowserViewer && getBrowserViewer()
    if (viewer && typeof viewer.setTheme === "function") viewer.setTheme(resolved)
  }

  function getTheme() {
    return currentTheme
  }

  function attachIpc({ ipcMain, wrapIpcOn }) {
    // 渲染进程通过 settings-changed 广播（设置窗口里的主题切换按钮）
    wrapIpcOn("settings-changed", (_event, type, data) => {
      if (type === "theme-changed" && data && data.theme) {
        applyToAll(data.theme)
      }
    })
  }

  return {
    applyToAll,
    applyToWindow,
    getTheme,
    bgFor,
    attachIpc,
  }
}

module.exports = { createThemeController, THEME_BG, bgFor }

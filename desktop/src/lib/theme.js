/**
 * theme.js — 主题切换运行时 (stub)
 * 由 desktop/src/lib/theme.ts 编译生成，或内联在 index.html 前执行。
 * 提供：window.__applyTheme(themeName) 供运行时调用
 */
(function() {
  const THEME_KEY = 'rem.theme';
  function applyTheme(name) {
    document.documentElement.setAttribute('data-theme', name || 'warm-paper');
    try { localStorage.setItem(THEME_KEY, name || 'warm-paper'); } catch(e) {}
  }
  // 同步应用缓存的主题（避免 FOUC）
  try {
    const cached = localStorage.getItem(THEME_KEY) || 'warm-paper';
    document.documentElement.setAttribute('data-theme', cached);
  } catch(e) {}
  window.__applyTheme = applyTheme;
})();

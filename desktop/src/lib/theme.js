/**
 * 主题加载器 — 由构建脚本复制到 lib/theme.js
 * 提供 window.setTheme / window.setPaperTexture / window.setSerifFont
 * 以及 window.loadSavedTheme / window.loadSavedFont / window.loadSavedPaperTexture
 *
 * 每个主题有独立的 CSS 文件（themes/<name>.css），
 * setTheme 需要同时切换 <link id="themeSheet"> 的 href 和设置 data-theme 属性。
 */

(function () {
  var themeKey = 'openshadow.theme';
  var textureKey = 'openshadow-paper-texture';
  var fontKey = 'openshadow-font-serif';

  // 旧主题 ID 到新 ID 的映射（兼容 legacy 代码）
  var LEGACY_ALIASES = {
    'cool-night': 'midnight',
  };

  /** 切换主题：1. 换 CSS 文件  2. 设置 data-theme 属性 */
  function setTheme(name) {
    if (!name) name = 'warm-paper';

    // 兼容旧主题名称
    var cssName = LEGACY_ALIASES[name] || name;

    // 1. 切换主题 CSS 文件
    // 注意：打包版（dist-renderer/index.html）不含 <link id="themeSheet">，
    // vite 把初始 warm-paper 合并进了产物 CSS 但未保留动态切换用的 link。
    // 因此在缺失时动态创建，确保 dev 与安装包都能切换主题 CSS。
    var themeSheet = document.getElementById('themeSheet');
    if (!themeSheet) {
      themeSheet = document.createElement('link');
      themeSheet.rel = 'stylesheet';
      themeSheet.id = 'themeSheet';
      document.head.appendChild(themeSheet);
    }
    themeSheet.setAttribute('href', 'themes/' + cssName + '.css');

    // 2. 设置 data-theme 属性（驱动 styles.css 里的覆盖）
    document.documentElement.setAttribute('data-theme', name);

    try { localStorage.setItem(themeKey, name); } catch (e) {}
  }

  function setPaperTexture(enabled) {
    if (enabled) {
      document.body.classList.add('paper-texture');
      try { localStorage.setItem(textureKey, '1'); } catch (e) {}
    } else {
      document.body.classList.remove('paper-texture');
      try { localStorage.setItem(textureKey, '0'); } catch (e) {}
    }
  }

  function setSerifFont(enabled) {
    if (enabled) {
      document.body.classList.add('serif-font');
    } else {
      document.body.classList.remove('serif-font');
    }
    try { localStorage.setItem(fontKey, enabled ? '1' : '0'); } catch (e) {}
  }

  /** React bootstrap 调用的加载函数：从 localStorage 恢复偏好并应用 */
  function loadSavedTheme() {
    var savedTheme = localStorage.getItem(themeKey) || 'warm-paper';
    setTheme(savedTheme);
  }

  function loadSavedFont() {
    var savedFont = localStorage.getItem(fontKey) || '0';
    setSerifFont(savedFont === '1');
  }

  function loadSavedPaperTexture() {
    var savedTexture = localStorage.getItem(textureKey);
    // 默认启用纸张纹理（除非显式设为 '0'）
    setPaperTexture(savedTexture !== '0');
  }

  // 暴露到全局
  window.setTheme = setTheme;
  window.setPaperTexture = setPaperTexture;
  window.setSerifFont = setSerifFont;
  window.loadSavedTheme = loadSavedTheme;
  window.loadSavedFont = loadSavedFont;
  window.loadSavedPaperTexture = loadSavedPaperTexture;

  // 页面加载时立即应用保存的主题（避免 FOUC）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSavedTheme);
  } else {
    loadSavedTheme();
  }
})();

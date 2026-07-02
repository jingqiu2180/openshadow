/**
 * 主题加载器 — 由 Vite 复制到 lib/theme.js
 * 提供 window.setTheme / window.setPaperTexture / window.setSerifFont
 *
 * 每个主题有独立的 CSS 文件（themes/<name>.css），
 * setTheme 需要同时切换 <link id="themeSheet"> 的 href 和设置 data-theme 属性。
 */

(function () {
  var themeKey = 'hana.theme';
  var textureKey = 'hana-paper-texture';

  function applySavedTheme() {
    var savedTheme = localStorage.getItem(themeKey) || 'warm-paper';
    setTheme(savedTheme);
  }

  /** 切换主题：1. 换 CSS 文件  2. 设置 data-theme 属性 */
  function setTheme(name) {
    if (!name) name = 'warm-paper';

    // 1. 切换主题 CSS 文件
    var themeSheet = document.getElementById('themeSheet');
    if (themeSheet) {
      themeSheet.setAttribute('href', 'themes/' + name + '.css');
    }

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
    try { localStorage.setItem('hana-font-serif', enabled ? '1' : '0'); } catch (e) {}
  }

  // 暴露到全局
  window.setTheme = setTheme;
  window.setPaperTexture = setPaperTexture;
  window.setSerifFont = setSerifFont;

  // 页面加载时立即应用保存的主题（避免 FOU C）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applySavedTheme);
  } else {
    applySavedTheme();
  }
})();

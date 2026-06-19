module.exports = {
  THEMES: { default: { id: 'default', i18nName: 'Default' } },
  AUTO_OPTION: { id: 'auto', i18nName: 'Auto' },
  getThemeIds: function() { return ['default', 'auto'] },
  getTheme: function(id) { return this.THEMES[id] || this.AUTO_OPTION },
  isDark: function() { return false },
}

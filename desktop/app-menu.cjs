function installAppMenu({ Menu, app, platform = process.platform, mt }) {
  const _ = mt || ((key, d) => d || key)
  const appName = app.name || 'OpenShadow'
  const template = [
    ...(platform === 'darwin'
      ? [
          {
            label: appName,
            submenu: [
              { role: 'about', label: _('appmenu.about', `关于 ${appName}`) },
              { type: 'separator' },
              { role: 'hide', label: _('appmenu.hide', `隐藏 ${appName}`) },
              { role: 'hideOthers', label: _('appmenu.hideOthers', '隐藏其他') },
              { role: 'unhide', label: _('appmenu.unhide', '显示全部') },
              { type: 'separator' },
              { role: 'quit', label: _('appmenu.quit', `退出 ${appName}`) },
            ],
          },
        ]
      : []),
    {
      label: _('appmenu.edit', 'Edit'),
      submenu: [
        { role: 'undo', label: _('appmenu.undo', '撤销') },
        { role: 'redo', label: _('appmenu.redo', '重做') },
        { type: 'separator' },
        { role: 'cut', label: _('appmenu.cut', '剪切') },
        { role: 'copy', label: _('appmenu.copy', '复制') },
        { role: 'paste', label: _('appmenu.paste', '粘贴') },
        { role: 'delete', label: _('appmenu.delete', '删除') },
        { type: 'separator' },
        { role: 'selectAll', label: _('appmenu.selectAll', '全选') },
      ],
    },
    {
      label: _('appmenu.window', 'Window'),
      submenu: [
        { role: 'minimize', label: _('appmenu.minimize', '最小化') },
        ...(platform === 'darwin'
          ? [{ role: 'zoom', label: _('appmenu.zoom', '缩放') }, { type: 'separator' }, { role: 'front', label: _('appmenu.front', '前置全部窗口') }]
          : [{ role: 'close', label: _('appmenu.close', '关闭') }]),
      ],
    },
  ]

  const appMenu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(appMenu)
}

module.exports = { installAppMenu }

function installAppMenu({ Menu, app, platform = process.platform }) {
  const appName = app.name || 'OpenShadow'
  const template = [
    ...(platform === 'darwin'
      ? [
          {
            label: appName,
            submenu: [
              { role: 'about', label: `关于 ${appName}` },
              { type: 'separator' },
              { role: 'hide', label: `隐藏 ${appName}` },
              { role: 'hideOthers', label: '隐藏其他' },
              { role: 'unhide', label: '显示全部' },
              { type: 'separator' },
              { role: 'quit', label: `退出 ${appName}` },
            ],
          },
        ]
      : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'delete', label: '删除' },
        { type: 'separator' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize', label: '最小化' },
        ...(platform === 'darwin'
          ? [{ role: 'zoom', label: '缩放' }, { type: 'separator' }, { role: 'front', label: '前置全部窗口' }]
          : [{ role: 'close', label: '关闭' }]),
      ],
    },
  ]

  const appMenu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(appMenu)
}

module.exports = { installAppMenu }

function createNotificationController({
  app,
  Notification,
  systemPreferences,
  wrapIpcHandler,
  getMainWindow,
}) {
  let pendingNotificationCount = 0

  function getPermissionStatus() {
    if (!Notification.isSupported()) return 'unsupported'
    if (process.platform !== 'darwin') return 'granted'
    try {
      const settings = systemPreferences.getNotificationSettings?.()
      const status = settings?.authorizationStatus
      if (status === 'authorized' || status === 'provisional') return 'granted'
      if (status === 'denied') return 'denied'
      return 'not-determined'
    } catch {
      return 'granted'
    }
  }

  function show(title, body) {
    if (!Notification.isSupported()) return
    const notif = new Notification({
      title: title || 'OpenShadow',
      body: body || '',
      silent: false,
    })
    notif.on('click', () => {
      const mainWindow = getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.show()
        mainWindow.focus()
      }
    })
    notif.show()

    const mainWindow = getMainWindow()
    if (process.platform === 'darwin' && mainWindow && (!mainWindow.isVisible() || !mainWindow.isFocused())) {
      pendingNotificationCount++
      app.dock?.setBadge(String(pendingNotificationCount))
    }
  }

  function clearDockBadge() {
    if (process.platform !== 'darwin') return
    pendingNotificationCount = 0
    app.dock?.setBadge('')
  }

  function register() {
    wrapIpcHandler('get-notification-permission-status', () => getPermissionStatus())
    wrapIpcHandler('request-notification-permission', () => {
      // macOS: show a dummy notification to trigger permission prompt
      if (getPermissionStatus() !== 'not-determined') return getPermissionStatus()
      try {
        const notif = new Notification({ title: 'OpenShadow', body: 'Notifications enabled', silent: true })
        notif.show()
      } catch {}
      return getPermissionStatus()
    })
    wrapIpcHandler('show-notification', (_event, title, body) => {
      show(title, body)
      return { ok: true }
    })
  }

  return { clearDockBadge, getPermissionStatus, register, show }
}

module.exports = { createNotificationController }

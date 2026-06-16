/**
 * Rem Wizard — preload script
 *
 * Runs in the wizard BrowserWindow with contextIsolation enabled.
 * Exposes a typed `window.wizard` object that the renderer uses to call
 * main-process IPC handlers.
 */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('wizard', {
  /** Pull the current config.json so the wizard can resume / prefill. */
  getConfig: () => ipcRenderer.invoke('wizard:get-config'),

  /** Persist wizard results (also marks wizard.completed=true). */
  saveConfig: (cfg) => ipcRenderer.invoke('wizard:save-config', cfg),

  /** Probe a provider's credentials with a max_tokens:1 call. */
  testConnection: (provider) => ipcRenderer.invoke('wizard:test-connection', provider),

  /** Native folder picker (multi-select). Returns array of paths or [] on cancel. */
  pickFolder: () => ipcRenderer.invoke('wizard:pick-folder'),

  /** Notify the main process that the wizard finished successfully. */
  done: () => ipcRenderer.send('wizard:done-signal'),
})

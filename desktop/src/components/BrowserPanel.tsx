/**
 * BrowserPanel — embeds a <webview> for in-app browsing.
 *
 * Receives commands from main process via IPC, executes them on the webview,
 * and sends responses back.
 *
 * State is managed via a simple React ref to the webview element.
 * Communication: main process → ipcRenderer → this component → webview → back.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react'

// We access Electron APIs through the preload bridge
const remApi = (window as any).__REM_API__ || {}

interface BrowserPanelProps {
  visible: boolean
  onClose: () => void
}

export default function BrowserPanel({ visible, onClose }: BrowserPanelProps) {
  const webviewRef = useRef<any>(null)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [commandQueue, setCommandQueue] = useState<any[]>([])

  // ─── Webview event handlers ───────────────────────────────────────
  useEffect(() => {
    const wv = webviewRef.current
    if (!wv) return

    const onDidNavigate = (e: any) => {
      setUrl(e.url)
      setLoading(false)
    }
    const onDidStartLoading = () => setLoading(true)
    const onDidStopLoading = () => setLoading(false)
    const onPageTitleUpdated = (e: any) => setTitle(e.title)

    wv.addEventListener('did-navigate', onDidNavigate)
    wv.addEventListener('did-navigate-in-page', onDidNavigate)
    wv.addEventListener('did-start-loading', onDidStartLoading)
    wv.addEventListener('did-stop-loading', onDidStopLoading)
    wv.addEventListener('page-title-updated', onPageTitleUpdated)

    return () => {
      wv.removeEventListener('did-navigate', onDidNavigate)
      wv.removeEventListener('did-navigate-in-page', onDidNavigate)
      wv.removeEventListener('did-start-loading', onDidStartLoading)
      wv.removeEventListener('did-stop-loading', onDidStopLoading)
      wv.removeEventListener('page-title-updated', onPageTitleUpdated)
    }
  }, [visible])

  // ─── Listen for commands from main process ────────────────────────
  useEffect(() => {
    if (!remApi.onBrowserCommand) return

    const unsubscribe = remApi.onBrowserCommand((cmd: any) => {
      const wv = webviewRef.current
      if (!wv) return

      handleCommand(wv, cmd)
    })

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [visible])

  // ─── Command execution ────────────────────────────────────────────
  const handleCommand = useCallback(async (wv: any, cmd: any) => {
    try {
      let result: any

      switch (cmd.type) {
        case 'navigate':
          await wv.loadURL(cmd.url)
          result = { success: true, data: { url: cmd.url, title: wv.getTitle() } }
          break

        case 'goBack':
          if (wv.canGoBack()) { wv.goBack(); result = { success: true } }
          else result = { success: false, error: 'Cannot go back' }
          break

        case 'goForward':
          if (wv.canGoForward()) { wv.goForward(); result = { success: true } }
          else result = { success: false, error: 'Cannot go forward' }
          break

        case 'reload':
          wv.reload()
          result = { success: true }
          break

        case 'screenshot': {
          const image = await wv.capturePage()
          const base64 = image.toPNG().toString('base64')
          const size = image.getSize()
          result = { success: true, data: { base64, width: size.width, height: size.height } }
          break
        }

        case 'click':
          // Execute JS to click an element by selector
          await wv.executeJavaScript(`
            (function() {
              const el = document.querySelector(${JSON.stringify(cmd.selector)});
              if (el) { el.click(); return true; }
              return false;
            })()
          `)
          result = { success: true, data: { selector: cmd.selector } }
          break

        case 'type': {
          // Focus and type into an element
          const typeResult = await wv.executeJavaScript(`
            (function() {
              const el = document.querySelector(${JSON.stringify(cmd.selector)});
              if (!el) return false;
              el.focus();
              el.value = '';
              // Use InputEvent for realistic typing
              const text = ${JSON.stringify(cmd.text)};
              for (const ch of text) {
                el.dispatchEvent(new InputEvent('input', { data: ch, inputType: 'insertText' }));
              }
              el.value = text;
              el.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            })()
          `)
          if (typeResult) {
            result = { success: true, data: { text: cmd.text } }
          } else {
            result = { success: false, error: `Element not found: ${cmd.selector}` }
          }
          break
        }

        case 'pressKey':
          // Send key event via JS
          await wv.executeJavaScript(`
            (function() {
              const key = ${JSON.stringify(cmd.key)};
              document.dispatchEvent(new KeyboardEvent('keydown', { key }));
              document.dispatchEvent(new KeyboardEvent('keyup', { key }));
            })()
          `)
          result = { success: true }
          break

        case 'getText': {
          const text = await wv.executeJavaScript(`
            document.querySelector(${JSON.stringify(cmd.selector)})?.textContent ?? ''
          `)
          result = { success: true, data: { text } }
          break
        }

        case 'getHtml': {
          const html = await wv.executeJavaScript(`document.documentElement.outerHTML.slice(0, 5000)`)
          result = { success: true, data: { html } }
          break
        }

        case 'waitForSelector': {
          const timeout = cmd.timeout || 10000
          const found = await wv.executeJavaScript(`
            new Promise((resolve) => {
              if (document.querySelector(${JSON.stringify(cmd.selector)})) { resolve(true); return; }
              const observer = new MutationObserver(() => {
                if (document.querySelector(${JSON.stringify(cmd.selector)})) {
                  observer.disconnect();
                  resolve(true);
                }
              });
              observer.observe(document.body, { childList: true, subtree: true });
              setTimeout(() => { observer.disconnect(); resolve(false); }, ${timeout});
            })
          `)
          if (found) result = { success: true }
          else result = { success: false, error: `Wait timed out for selector: ${cmd.selector}` }
          break
        }

        default:
          result = { success: false, error: `Unknown command: ${cmd.type}` }
      }

      // Send response back to main process
      if (remApi.sendBrowserResponse) {
        remApi.sendBrowserResponse({ id: cmd.id, ...result })
      }
    } catch (e: any) {
      if (remApi.sendBrowserResponse) {
        remApi.sendBrowserResponse({ id: cmd.id, success: false, error: e.message })
      }
    }
  }, [])

  if (!visible) return null

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, width: '55%',
      display: 'flex', flexDirection: 'column',
      background: '#fff', borderLeft: '1px solid #e0ddd8',
      zIndex: 100,
    }}>
      {/* URL bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', borderBottom: '1px solid #e8e4df',
        background: '#f9f7f4',
      }}>
        <button onClick={() => webviewRef.current?.goBack()} style={navBtnStyle} title="后退">◀</button>
        <button onClick={() => webviewRef.current?.goForward()} style={navBtnStyle} title="前进">▶</button>
        <button onClick={() => webviewRef.current?.reload()} style={navBtnStyle} title="刷新">↻</button>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && url) {
              webviewRef.current?.loadURL(url.startsWith('http') ? url : `https://${url}`)
            }
          }}
          placeholder="输入网址..."
          style={{
            flex: 1, padding: '4px 8px', borderRadius: 4,
            border: '1px solid #ddd', fontSize: 13, outline: 'none',
          }}
        />
        {loading && <span style={{ fontSize: 12, color: '#999' }}>加载中...</span>}
        <button onClick={onClose} style={navBtnStyle} title="关闭">✕</button>
      </div>

      {/* Title bar */}
      {title && (
        <div style={{ padding: '2px 12px', fontSize: 11, color: '#999', borderBottom: '1px solid #eee' }}>
          {title}
        </div>
      )}

      {/* Webview */}
      <webview
        ref={webviewRef as any}
        style={{ flex: 1, border: 'none' }}
        {...{ sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups', allowpopups: true } as any}
      />
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  background: 'none', border: '1px solid #ddd', borderRadius: 4,
  padding: '2px 8px', cursor: 'pointer', fontSize: 13, color: '#666',
}

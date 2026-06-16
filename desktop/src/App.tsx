import React, { useState } from 'react'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import DeskPanel from './components/DeskPanel'
import BrowserPanel from './components/BrowserPanel'

export default function App() {
  const [browserVisible, setBrowserVisible] = useState(false)

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      background: '#faf8f5',
      color: '#2c2c2c',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      position: 'relative',
    }}>
      <div style={{ width: 240, flexShrink: 0, borderRight: '1px solid #e8e4df' }}>
        <Sidebar />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <ChatArea onToggleBrowser={() => setBrowserVisible(v => !v)} />
      </div>
      <div style={{ width: 280, flexShrink: 0, borderLeft: '1px solid #e8e4df' }}>
        <DeskPanel />
      </div>
      <BrowserPanel visible={browserVisible} onClose={() => setBrowserVisible(false)} />
    </div>
  )
}

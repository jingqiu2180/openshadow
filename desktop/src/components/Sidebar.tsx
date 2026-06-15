import React from 'react'
import { useStore } from '../store'

export default function Sidebar() {
  const { conversations, currentId, newConversation, setActive } = useStore()

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#f5f2ed',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #e8e4df',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, #f093fb, #f5576c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 16, fontWeight: 600,
          }}>R</div>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#333' }}>Rem</span>
        </div>
        <button
          onClick={newConversation}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 20, color: '#888', padding: 4,
          }}
          title="新对话"
        >+</button>
      </div>

      {/* Conversation list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {conversations.map(conv => (
          <div
            key={conv.id}
            onClick={() => setActive(conv.id)}
            style={{
              padding: '10px 16px',
              cursor: 'pointer',
              fontSize: 13,
              color: conv.id === currentId ? '#333' : '#888',
              background: conv.id === currentId ? '#f0ede8' : 'transparent',
              borderLeft: conv.id === currentId ? '3px solid #667eea' : '3px solid transparent',
              transition: 'background 0.15s',
            }}
          >
            <div style={{ fontWeight: conv.id === currentId ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {conv.title || '新对话'}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid #e8e4df',
        fontSize: 12,
        color: '#aaa',
        textAlign: 'center',
      }}>
        Rem Agent v0.1.0
      </div>
    </div>
  )
}

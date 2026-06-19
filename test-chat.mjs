// remu Chat 测试脚本 — 自动创建 session + 流式对话
// 用法: cd D:\src\aicoding\remu && node test-chat.mjs
import { WebSocket } from 'ws'

const BASE = 'http://127.0.0.1:3000'
const PROMPT = process.argv[2] || '请用一句话介绍你自己'

async function setup() {
  // 1. 设置模型
  const m = await fetch(`${BASE}/api/models/set`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId: 'MiniMax-M2.1', provider: 'minimax-token-plan' })
  })
  if (!m.ok) throw new Error(`model set failed: ${m.status}`)

  // 2. 创建 session
  const s = await fetch(`${BASE}/api/sessions/new?agentId=rem-default`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
  })
  const session = await s.json()
  if (!session.ok) throw new Error(`session failed: ${JSON.stringify(session)}`)
  return session.path
}

let closed = false
function done(code) { if (closed) return; closed = true; process.exit(code) }

async function main() {
  const sessionPath = await setup()
  console.log('Session:', sessionPath.replace(/.*?agents/, 'agents'))

  const ws = new WebSocket('ws://127.0.0.1:3000/api/ws')
  ws.on('open', () => {
    ws.send(JSON.stringify({
      type: 'prompt', sessionPath, text: PROMPT, thinkingLevel: 'medium',
    }))
    console.log(`\n> ${PROMPT}\n`)
  })

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString())
    if (msg.type === 'app_event') {
      const e = msg.event
      if (e.type === 'message_update' && e.assistantMessageEvent?.type === 'text_delta') {
        process.stdout.write(e.assistantMessageEvent.delta)
      } else if (e.type === 'session_status' && e.isStreaming === false) {
        console.log('\n\n✅ Done')
        done(0)
      } else if (e.type === 'error') {
        console.error('\n❌', e.message || e)
        done(1)
      }
    }
  })

  ws.on('error', (err) => { console.error('WS Error:', err.message); done(1) })
  setTimeout(() => { console.log('\n⏰ Timeout'); done(1) }, 60000)
}

main().catch(err => { console.error(err.message); process.exit(1) })

// 简单 WebSocket 聊天测试脚本
// 用法：node test-chat.mjs
import WebSocket from 'ws';

const WS_URL = 'ws://127.0.0.1:3000/ws';
const SESSION_PATH = 'D:\\src\\aicoding\\remu\\agents\\rem-default\\sessions\\test-' + Date.now() + '.jsonl';

console.log('[test] Connecting to', WS_URL);
const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('[test] Connected!');
  
  // 发送 chat 消息
  const msg = {
    type: 'chat',
    sessionPath: SESSION_PATH,
    content: 'hello from test script, can you hear me?'
  };
  console.log('[test] Sending:', msg);
  ws.send(JSON.stringify(msg));
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());
    console.log('[test] Received:', msg.type, msg);
    
    if (msg.type === 'done') {
      console.log('[test] Chat complete!');
      ws.close();
      process.exit(0);
    }
  } catch (e) {
    console.error('[test] Parse error:', e.message);
  }
});

ws.on('error', (err) => {
  console.error('[test] WS error:', err.message);
});

ws.on('close', () => {
  console.log('[test] Connection closed');
});

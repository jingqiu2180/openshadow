import { chromium } from 'playwright';

async function testRemu() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // 监听所有 console 日志
  page.on('console', msg => {
    console.log('[BROWSER]', msg.type(), msg.text().slice(0, 150));
  });
  
  console.log('[TEST] Loading...');
  await page.goto('http://localhost:5173');
  
  // 等待初始化完成（session + WS connected）
  let initOk = false;
  try {
    await page.waitForFunction(() => {
      const s = window.__STORE__?.getState?.();
      return s && s.currentSessionPath && s.wsState === 'connected';
    }, { timeout: 15000 });
    initOk = true;
    console.log('[TEST] Init OK');
  } catch(e) {
    console.log('[TEST] Init FAILED, checking state...');
    const state = await page.evaluate(() => {
      const s = window.__STORE__?.getState?.();
      return { currentSessionPath: s?.currentSessionPath, wsState: s?.wsState };
    });
    console.log('[TEST] State:', JSON.stringify(state));
  }
  
  await page.waitForTimeout(2000);
  
  // 检查 WS 状态并发送消息
  const sendResult = await page.evaluate(() => {
    const ws = window.__getWebSocket ? window.__getWebSocket() : null;
    const sp = window.__STORE__.getState().currentSessionPath;
    const wsState = window.__STORE__.getState().wsState;
    const info = { wsExists: !!ws, wsReadyState: ws?.readyState, wsState, sessionPath: sp };
    
    if (ws && ws.readyState === WebSocket.OPEN && sp) {
      const msg = { type: 'chat', content: 'hi', sessionPath: sp };
      ws.send(JSON.stringify(msg));
      info.sent = true;
      info.sentMsg = msg;
    } else {
      info.sent = false;
    }
    return info;
  });
  console.log('[TEST] Send result:', JSON.stringify(sendResult, null, 2));
  
  console.log('[TEST] Waiting 18s for reply...');
  await page.waitForTimeout(18000);
  
  // 等待 React 渲染
  await page.waitForTimeout(2000);
  
  // 检查结果 + DOM
  const r = await page.evaluate(() => {
    const s = window.__STORE__.getState();
    const sp = s.currentSessionPath;
    
    // 检查 DOM 中是否有消息元素
    const msgEls = document.querySelectorAll('[data-chat-selection-root] [data-message-id]');
    
    // 检查每个消息元素的位置和可见性
    const msgDetails = [];
    msgEls.forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      msgDetails.push({
        index: i,
        text: el.textContent?.slice(0, 80),
        rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        overflow: style.overflow,
        className: el.className?.slice(0, 60),
        offsetTop: el.offsetTop,
        scrollHeight: el.scrollHeight,
      });
    });
    
    // 检查 sessionShell 和 sessionPanel 的位置（用更通用的选择器）
    const chatAreaEl = document.querySelector('.chatArea');
    const allDivs = document.querySelector('[class*="chat"]') || document.querySelector('main') || document.body;
    
    // 找包含 message 元素的最近祖先
    const firstMsg = msgEls[0];
    let parentChain = [];
    if (firstMsg) {
      let el = firstMsg.parentElement;
      for (let i = 0; i < 8 && el; i++) {
        const rect = el.getBoundingClientRect();
        parentChain.push({
          tag: el.tagName,
          className: (el.className || '').toString().slice(0, 80),
          rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
          overflow: window.getComputedStyle(el).overflow,
          display: window.getComputedStyle(el).display,
          height: el.offsetHeight,
        });
        el = el.parentElement;
      }
    }
    
    return {
      itemsCount: s.chatSessions?.[sp]?.items?.length || 0,
      wsState: s.wsState,
      welcomeVisible: s.welcomeVisible,
      domMessageElements: msgEls.length,
      msgDetails: msgDetails.slice(0, 1), // 只保留第一个消息的详情
      parentChain,
    };
  });
  console.log('[RESULT]', JSON.stringify(r));
  
  await page.screenshot({ path: 'D:/src/aicoding/remu/test-final.png', fullPage: true });
  await browser.close();
}

testRemu().catch(console.error);

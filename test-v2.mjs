import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, 'desktop', 'test-screenshots');
const BASE_URL = 'http://localhost:5173';

if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  let pass = 0, fail = 0, warn = 0;

  function log(s, m) {
    console.log(`${s === 'pass' ? '\u2705' : s === 'fail' ? '\u274c' : '\u26a0\ufe0f'} ${m}`);
    if (s === 'pass') pass++; else if (s === 'fail') fail++; else warn++;
  }

  try {
    // Force refresh to get updated i18n
    await page.goto(BASE_URL + '?_t=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 15000 });
    await wait(2500);

    // 1. 页面加载
    const bodyText = await page.evaluate(() => document.body.innerText);
    log(bodyText.length > 100 ? 'pass' : 'fail', `页面加载 (${bodyText.length} chars)`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v2-01-home.png'), fullPage: true });

    // 2. 英文 UI 扫描
    const english = await page.evaluate(() => {
      const skip = new Set(['HTTP','HTTPS','API','JSON','CSS','HTML','SVG','UUID','MCP','LLM','SSE','WS','TCP','IP','URL','ID','OK','AI','Rem','GitHub','MiniMax','OpenAI','BMC','RAID','BIOS','CPLD','NTP','SMTP','SNMP','SYSLOG','AD','LDAP','SSL','SSH','TLS','OAuth','JWT','CORS','CSP','HMR','ESM','CJS','TS','JS','TSX','JSX','Vite','Electron','Node','npm','pnpm','Git','YAML','JSONL','SQLite','PostgreSQL','Redis','Docker','Kubernetes','CPU','RAM','GPU','SSD','HDD','URI','UTC','GMT','ISO','RFC','SHA','MD5','RSA','AES','UDP','ICMP','DNS','DHCP','FTP','SFTP','POP3','IMAP','MQTT','CoAP','Modbus','BACnet','KNX','Zigbee','Z-Wave','Bluetooth','WiFi','Ethernet','USB','HDMI','NVMe','SATA','SAS','PCIe','DDR','DIMM','ARM','x86','x64','RISC-V','MIPS','PowerPC','SPARC','Alpha','Ryzen','Threadripper','Xeon','Core','Pentium','Celeron','Atom','Itanium','EPYC','QQ','STDIO','SSE']);
      const hits = [];
      (function walk(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          const t = node.textContent.trim();
          if (t.length > 1 && /^[A-Z][a-z]{1,}$/.test(t) && !skip.has(t) && !['SCRIPT','STYLE','TEXTAREA'].includes(node.parentElement?.tagName)) {
            hits.push({ text: t, tag: node.parentElement?.tagName });
          }
        }
        for (const c of node.childNodes) walk(c);
      })(document.body);
      return hits;
    });
    if (english.length > 0) english.forEach(h => log('warn', `英文: "${h.text}" <${h.tag}>`));
    else log('pass', '无硬编码英文文本');

    // 3. 输入框
    const inputOk = await page.evaluate(() => {
      const el = document.querySelector('.input-area textarea, .ProseMirror[contenteditable="true"]');
      return !!el && el.getBoundingClientRect().width > 0;
    });
    log(inputOk ? 'pass' : 'fail', '聊天输入框可见');

    // 4. 发送按钮（用多种选择器）
    const sendFound = await page.evaluate(() => {
      return !!document.querySelector('button[title*="发送"]')
        || !!document.querySelector('[class*="send-btn"] button')
        || Array.from(document.querySelectorAll('button')).some(b => b.textContent?.includes('发送'));
    });
    log(sendFound ? 'pass' : 'warn', '发送按钮存在');

    // 5. 左侧边栏中文
    const sidebar = await page.evaluate(() => document.querySelector('[class*="sidebar"], [class*="Sidebar"]')?.innerText || '');
    log(['对话','新对话','设置'].some(w => sidebar.includes(w)) ? 'pass' : 'fail', `左侧栏中文`);

    // 6. 右侧栏中文
    const desk = await page.evaluate(() => document.querySelector('[class*="Desk"], [class*="desk"]')?.innerText || '');
    log(['笺','文件','工作区'].some(w => desk.includes(w)) ? 'pass' : 'fail', `右侧栏中文`);

    // 7. 检查 Beta 标签
    const beta = await page.evaluate(() => document.body.innerText.includes('Beta'));
    log(!beta ? 'pass' : 'warn', 'Beta 标签已翻译');

    // 8. 点击新对话
    const ncBtn = await page.$('button[title*="新对话"]');
    if (ncBtn) {
      await ncBtn.click();
      await wait(1200);
      log('pass', '新对话按钮可点击');
    }

    // 9. 点击设置
    const setBtn = await page.$('button[title*="设置"]');
    if (setBtn) {
      await setBtn.click();
      await wait(1500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v2-02-settings.png'), fullPage: true });
      const setTxt = await page.evaluate(() => document.querySelector('[class*="Settings"], [class*="settings"]')?.innerText || '');
      log(['通用','模型','智能体'].some(w => setTxt.includes(w)) ? 'pass' : 'warn', `设置面板中文`);
      
      // 关闭设置面板
      const closeBtn = await page.$('[data-testid="settings-modal-overlay"] [class*="close"], button[aria-label*="关闭"]');
      if (closeBtn) {
        await closeBtn.click();
        await wait(500);
        log('pass', '设置面板关闭');
      }
    }

    // 10. 最终截图
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v2-03-final.png'), fullPage: true });
    log('pass', '最终截图保存');
    
  } catch (e) {
    log('fail', `异常: ${e.message}`);
  } finally {
    console.log(`\n=== 结果: \u2705${pass} | \u274c${fail} | \u26a0\ufe0f${warn} ===`);
    await browser.close();
  }
})();

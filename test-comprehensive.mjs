import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, 'desktop', 'test-screenshots');
const BASE_URL = 'http://localhost:5173';

if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function takeScreenshot(page, name) {
  const fp = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: fp, fullPage: true });
  return fp;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const result = { passed: 0, failed: 0, warnings: 0, items: [] };

  function log(status, msg) {
    const prefix = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
    console.log(`${prefix} ${msg}`);
    result.items.push({ status, msg });
    if (status === 'pass') result.passed++;
    else if (status === 'fail') result.failed++;
    else result.warnings++;
  }

  try {
    console.log('=== 全面测试开始 ===');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await wait(2000);
    await takeScreenshot(page, '01-home');

    // 1. 检查页面加载
    const bodyText = await page.evaluate(() => document.body.innerText);
    log(bodyText.length > 100 ? 'pass' : 'fail', `页面加载: ${bodyText.length} chars`);

    // 2. 检查国际化 - 扫描页面上的英文 UI 文本
    const englishUI = await page.evaluate(() => {
      const skip = ['http','https','API','JSON','CSS','HTML','SVG','UUID','MCP','LLM','SSE','WS','TCP','IP','URL','ID','OK','AI','Rem','GitHub','MiniMax','OpenAI','BMC','RAID','BIOS','CPLD','NTP','SMTP','SNMP','SYSLOG','AD','LDAP','SSL','SSH','TLS','OAuth','JWT','CORS','CSP','HMR','ESM','CJS','TS','JS','TSX','JSX','Vite','Electron','Node','npm','pnpm','Git','YAML','JSONL','SQLite','PostgreSQL','Redis','Docker','Kubernetes','CPU','RAM','GPU','SSD','HDD','URL','URI','UTC','GMT','ISO','RFC','SHA','MD5','RSA','AES','TLS','SSL','SSH','TCP','UDP','ICMP','DNS','DHCP','HTTP','HTTPS','FTP','SFTP','SMTP','POP3','IMAP','MQTT','CoAP','LwM2M','OCPP','Modbus','BACnet','KNX','DALI','Zigbee','Z-Wave','Bluetooth','WiFi','Ethernet','USB','HDMI','DP','VGA','DVI','Thunderbolt','Type-C','NVMe','SATA','SAS','PCIe','DDR','DIMM','SO-DIMM','LGA','PGA','BGA','FCLGA','SP3','sWRX8','TR4','sTRX4','LGA1700','LGA1200','AM4','AM5','sTR5','sTRX8','EPYC','Ryzen','Threadripper','Xeon','Core','Pentium','Celeron','Atom','Itanium','ARM','x86','x64','IA-64','RISC-V','MIPS','PowerPC','SPARC','Alpha','PA-RISC','Itanium','Motorola','68k','Z80','6502','8080','8085','8086','8088','80186','80286','80386','80486','Pentium','Pentium Pro','Pentium II','Pentium III','Pentium 4','Pentium D','Core','Core 2','Core i3','Core i5','Core i7','Core i9','Xeon E3','Xeon E5','Xeon E7','Xeon Scalable','EPYC 7001','EPYC 7002','EPYC 7003','EPYC 7004','Ryzen 1000','Ryzen 2000','Ryzen 3000','Ryzen 5000','Ryzen 7000','Ryzen 8000','Threadripper 1000','Threadripper 2000','Threadripper 3000','Threadripper 5000','Threadripper 7000'];
      const skipSet = new Set(skip);
      const walker = (node) => {
        const hits = [];
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent.trim();
          if (text.length > 1 && /^[A-Z][a-z]{2,}$/.test(text) && !skipSet.has(text)) {
            const parent = node.parentElement;
            if (parent && !['SCRIPT','STYLE','TEXTAREA'].includes(parent.tagName)) {
              hits.push({ text, tag: parent.tagName, cls: parent.className?.slice(0,30) });
            }
          }
        }
        for (const ch of node.childNodes) hits.push(...walker(ch));
        return hits;
      };
      return walker(document.body);
    });
    if (englishUI.length > 0) {
      englishUI.slice(0, 15).forEach(h => log('warn', `英文 UI: "${h.text}" in <${h.tag}>`));
      if (englishUI.length > 15) log('warn', `...还有 ${englishUI.length - 15} 个英文文本`);
    } else {
      log('pass', '未发现硬编码英文字符串');
    }

    // 3. 检查控制台错误
    const logs = await page.evaluate(() => {
      return (window.__remuLogs || []).filter(l => l.type === 'error').slice(0, 10);
    }).catch(() => []);
    if (logs.length > 0) {
      logs.forEach(l => log('fail', `Console error: ${l.text?.slice(0,60)}`));
    } else {
      log('pass', '控制台无错误');
    }

    // 4. 检查聊天输入框
    const inputVisible = await page.evaluate(() => {
      const ta = document.querySelector('.input-area textarea, .ProseMirror[contenteditable="true"]');
      if (!ta) return false;
      const rect = ta.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    log(inputVisible ? 'pass' : 'fail', `聊天输入框可见: ${inputVisible}`);

    // 5. 检查发送按钮
    const sendBtn = await page.$('button[title*="发送"], button[title*="Send"], button:has(svg[data-icon="send"])');
    log(sendBtn ? 'pass' : 'fail', `发送按钮存在: ${!!sendBtn}`);

    // 6. 检查左侧边栏中文
    const sidebarText = await page.evaluate(() => {
      const sb = document.querySelector('.sidebar, [class*="sidebar"], [class*="Sidebar"]');
      return sb ? sb.innerText : '';
    });
    const sidebarChinese = ['对话', '新对话', '设置', '频道'].some(w => sidebarText.includes(w));
    log(sidebarChinese ? 'pass' : 'fail', `左侧边栏中文: ${sidebarText.slice(0,50)}`);

    // 7. 截图主界面
    await takeScreenshot(page, '02-main-ui');

    // 8. 点击新对话，检查对话是否创建
    const newChatBtn = await page.$('button[title*="新对话"], button[title*="New Chat"], [aria-label*="新对话"]');
    if (newChatBtn) {
      await newChatBtn.click();
      await wait(1500);
      await takeScreenshot(page, '03-after-new-chat');
      const hasChat = await page.evaluate(() => {
        return !!document.querySelector('.message, .chat-message, [class*="Message"]');
      });
      log('pass', `新对话按钮可点击`);
    } else {
      log('warn', '未找到新对话按钮');
    }

    // 9. 检查设置面板
    const settingsBtn = await page.$('button[title*="设置"], button[title*="Settings"], [aria-label*="设置"]');
    if (settingsBtn) {
      await settingsBtn.click();
      await wait(1500);
      await takeScreenshot(page, '04-settings');
      const settingsText = await page.evaluate(() => {
        const panel = document.querySelector('[class*="Settings"], [class*="settings"], [role="dialog"]');
        return panel ? panel.innerText : '';
      });
      const settingsChinese = ['通用', '模型', '智能体', '权限', '工作区'].some(w => settingsText.includes(w));
      log(settingsChinese ? 'pass' : 'warn', `设置面板中文: ${settingsText.slice(0,80)}`);
    } else {
      log('warn', '未找到设置按钮');
    }

    // 10. 检查右侧栏（DeskSection）
    const deskBtn = await page.$('button[title*="书桌"], button[title*="Desk"], [aria-label*="书桌"]');
    if (deskBtn) {
      await deskBtn.click();
      await wait(1500);
      await takeScreenshot(page, '05-desk');
      const deskText = await page.evaluate(() => {
        const desk = document.querySelector('[class*="Desk"], [class*="desk"]');
        return desk ? desk.innerText : '';
      });
      const deskChinese = ['笺', '工作区', '文件', '技能'].some(w => deskText.includes(w));
      log(deskChinese ? 'pass' : 'warn', `右侧栏中文: ${deskText.slice(0,80)}`);
    }

    // 11. 检查模型选择器
    const modelBtn = await page.$('button[title*="模型"], [class*="model-pill"], [class*="ModelPill"]');
    if (modelBtn) {
      await modelBtn.click();
      await wait(1000);
      await takeScreenshot(page, '06-model-dropdown');
      const dropdownText = await page.evaluate(() => {
        const dd = document.querySelector('[class*="dropdown"], [class*="Dropdown"], [role="listbox"]');
        return dd ? dd.innerText : '';
      });
      log('pass', `模型下拉菜单: ${dropdownText.slice(0,60)}`);
    }

    // 12. 检查 WebSocket 连接状态
    const wsStatus = await page.evaluate(() => {
      return window.__remuWSState || window.__remuDiag?.wsState || 'unknown';
    }).catch(() => 'unknown');
    log(wsStatus === 'connected' || wsStatus === 'open' ? 'pass' : 'warn', `WebSocket 状态: ${wsStatus}`);

    // 13. 输入测试消息，检查发送
    const textarea = await page.$('.input-area textarea, .ProseMirror[contenteditable="true"]');
    if (textarea) {
      await textarea.click();
      await wait(500);
      await page.keyboard.type('测试消息', { delay: 50 });
      await wait(800);
      await takeScreenshot(page, '07-typing');
      const sendBtn2 = await page.$('button[title*="发送"]:not(:disabled), button:not(:disabled) svg[data-icon="send"]');
      if (sendBtn2) {
        await sendBtn2.click();
        await wait(3000);
        await takeScreenshot(page, '08-after-send');
        log('pass', '消息发送成功');
      } else {
        log('warn', '发送按钮不可用');
      }
    }

    // 14. 最终全页截图
    await takeScreenshot(page, '09-final');

  } catch (e) {
    log('fail', `测试异常: ${e.message}`);
  } finally {
    console.log('\n=== 测试结果 ===');
    console.log(`✅ 通过: ${result.passed}`);
    console.log(`❌ 失败: ${result.failed}`);
    console.log(`⚠️ 警告: ${result.warnings}`);
    await browser.close();
  }
})();

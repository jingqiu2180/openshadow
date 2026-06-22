// verify-console.mjs — 检查 remu 页面的 console 错误
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  const errors = [];
  const warnings = [];
  const logs = [];

  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') errors.push(text);
    else if (type === 'warning') warnings.push(text);
    else if (type === 'log') logs.push(text);
  });

  page.on('pageerror', err => {
    errors.push(`PAGE ERROR: ${err.message}`);
  });

  console.log('[verify] 打开 remu...');
  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(5000);
  } catch (e) {
    console.log(`[verify] 页面加载失败: ${e.message}`);
  }

  console.log(`\n[verify] 完成！共 ${errors.length} 个错误, ${warnings.length} 个警告`);
  if (errors.length > 0) {
    console.log('\n=== ERRORS ===');
    errors.forEach((e, i) => console.log(`  [${i+1}] ${e}`));
  }
  if (warnings.length > 0) {
    console.log('\n=== WARNINGS ===');
    warnings.forEach((w, i) => console.log(`  [${i+1}] ${w}`));
  }
  if (logs.length > 0) {
    console.log('\n=== LOGS (前 30 条) ===');
    logs.slice(0, 30).forEach((l, i) => console.log(`  [${i+1}] ${l}`));
  }

  // 截图保存（即使不能看，也保存）
  await page.screenshot({ path: 'D:/screenshots/remu-ui-audit/verify-console.png', fullPage: true }).catch(() => {});
  console.log('\n[verify] 截图已保存（但模型不支持查看）');

  console.log('\n[verify] 浏览器保持打开，请手动检查...');
  // 不关闭浏览器，让用户手动检查
  // await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });

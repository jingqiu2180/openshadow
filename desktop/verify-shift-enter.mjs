import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

console.log('=== 验证：Shift+Enter 换行功能 ===\n');

// 点击编辑器
const editor = await page.$('.ProseMirror');
if (editor) {
  await editor.click();
  
  console.log('输入第一行...');
  await page.keyboard.type('第一行', { delay: 100 });
  const afterFirstLine = await editor.evaluate(el => el.textContent.trim());
  console.log(`  结果: "${afterFirstLine}"`);
  
  console.log('\n按 Shift+Enter 换行...');
  await page.keyboard.press('Shift+Enter');
  await page.waitForTimeout(200);
  const afterShiftEnter1 = await editor.evaluate(el => el.innerHTML);
  console.log(`  innerHTML: ${afterShiftEnter1.substring(0, 200)}`);
  console.log(`  textContent: ${el => el.textContent.trim()}`);
  
  console.log('\n输入第二行...');
  await page.keyboard.type('第二行', { delay: 100 });
  const afterSecondLine = await editor.evaluate(el => ({
    html: el.innerHTML,
    text: el.textContent.trim()
  }));
  console.log(`  HTML: ${afterSecondLine.html.substring(0, 300)}`);
  console.log(`  文本: "${afterSecondLine.text}"`);
  
  console.log('\n再次按 Shift+Enter...');
  await page.keyboard.press('Shift+Enter');
  await page.waitForTimeout(200);
  
  console.log('\n输入第三行...');
  await page.keyboard.type('第三行', { delay: 100 });
  const finalResult = await editor.evaluate(el => ({
    html: el.innerHTML,
    text: el.textContent.trim(),
    lineCount: el.textContent.trim().split('\n').length || 
             Array.from(el.querySelectorAll('p')).length
  }));
  
  console.log('\n=== 最终结果 ===');
  console.log(`文本内容: "${finalResult.text}"`);
  console.log(`段落数: ${finalResult.lineCount}`);
  
  if (finalResult.text.includes('第一行') && finalResult.text.includes('第二行') && finalResult.text.includes('第三行')) {
    console.log('\n✅ Shift+Enter 换行功能正常！');
  } else {
    console.log('\n❌ Shift+Enter 换行异常');
  }
} else {
  console.log('❌ 编辑器未找到');
}

console.log('\n=== 保持浏览器打开 60 秒 ===');
await page.screenshot({ path: 'verify-shift-enter.png' });
await page.waitForTimeout(60000);
await browser.close();

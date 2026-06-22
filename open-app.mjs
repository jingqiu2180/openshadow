import { chromium } from 'playwright';

async function openApp() {
  // Launch with head = false (will show browser UI)
  const browser = await chromium.launch({ headless: false, args: ['--window-size=1440,900'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log('Opening remu app...');
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 20000 });
  
  console.log('App opened. Browser will stay open for manual testing.');
  console.log('Press Ctrl+C to close.');
  
  // Keep alive — wait forever
  await new Promise(() => {});
}

openApp().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

const fs = require('node:fs');
const path = require('node:path');
const driver = process.env.PLAYWRIGHT_DRIVER || 'C:/Users/user/AppData/Local/VibeCoding/AgentTools/music-213f3ed1d0/node_modules/playwright-core';
const { chromium } = require(driver);
(async () => {
  fs.mkdirSync('.playwright-cli', { recursive: true });
  await require('sharp')({ create: { width: 720, height: 1080, channels: 3, background: '#164e63' } }).jpeg().toFile('.playwright-cli/synthetic.jpg');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const run = eval('(' + fs.readFileSync(path.join(__dirname, 'qr-portal.browser.js'), 'utf8') + ')');
    console.log(JSON.stringify(await run(page)));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });

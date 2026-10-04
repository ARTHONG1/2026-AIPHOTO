const fs = require('node:fs');
const path = require('node:path');
// Use the installed project Playwright CLI's matching browser driver; no package installation.
const driver = process.env.PLAYWRIGHT_DRIVER || 'C:/Users/user/AppData/Local/VibeCoding/AgentTools/music-213f3ed1d0/node_modules/playwright-core';
const { chromium } = require(driver);
(async () => {
  fs.mkdirSync(path.join(process.cwd(), '.playwright-cli'), { recursive: true });
  await require('sharp')({ create: { width: 720, height: 1080, channels: 3, background: '#164e63' } }).jpeg().toFile('.playwright-cli/synthetic.jpg');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const run = eval('(' + fs.readFileSync(path.join(__dirname, 'transfer.browser.js'), 'utf8') + ')');
    try {
      const result = await run(page);
      console.log(JSON.stringify(result));
    } catch (error) {
      let index = 0;
      for (const openContext of browser.contexts()) for (const openPage of openContext.pages()) {
        const label = 'transfer-failure-' + index++;
        console.error(label, new URL(openPage.url()).pathname, await openPage.locator('body').innerText().catch(() => 'Page unavailable'));
        await openPage.screenshot({ path: '.playwright-cli/' + label + '.png', fullPage: true }).catch(() => {});
      }
      throw error;
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });

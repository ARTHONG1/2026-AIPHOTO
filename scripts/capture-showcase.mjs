import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
const driverPath = 'C:/Users/user/AppData/Local/VibeCoding/AgentTools/music-213f3ed1d0/node_modules/playwright-core/index.mjs';
const { chromium } = await import(pathToFileURL(driverPath).href);

const outDir = path.resolve('docs/screenshots');
fs.mkdirSync(outDir, { recursive: true });

const origin = 'http://127.0.0.1:3012';

console.log('Launching browser...');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2
});

const page = await context.newPage();

try {
  // 1. Lobby
  console.log('1. Navigating to Lobby...');
  await page.goto(origin + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '01-lobby.png') });
  console.log('Saved 01-lobby.png');

  // 2. Booth
  console.log('2. Navigating to Booth...');
  await page.goto(origin + '/booth', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '02-booth.png') });
  console.log('Saved 02-booth.png');

  // Setup synthetic photo for studio
  const testPhotoPath = path.resolve('.playwright-cli/synthetic.jpg');
  await sharp({
    create: { width: 720, height: 1080, channels: 3, background: '#1e293b' }
  }).composite([
    {
      input: Buffer.from('<svg width="720" height="1080"><circle cx="360" cy="420" r="160" fill="#f59e0b"/><rect x="220" y="600" width="280" height="380" rx="60" fill="#3b82f6"/></svg>'),
      top: 0,
      left: 0
    }
  ]).jpeg().toFile(testPhotoPath);

  // Mock studio AI response
  const mockImage = await sharp(testPhotoPath).toBuffer().then(b => 'data:image/jpeg;base64,' + b.toString('base64'));
  await context.route('**/studio', async route => {
    if (route.request().method() === 'POST' && route.request().headers()['next-action']) {
      await route.fulfill({
        status: 200,
        contentType: 'text/x-component',
        body: '0:{"a":"$@1","f":"","b":"development"}\n1:' + JSON.stringify({ ok: true, image: mockImage }) + '\n'
      });
    } else {
      await route.continue();
    }
  });

  // Upload photo to go to studio
  console.log('3. Uploading photo to enter Studio...');
  await page.locator('input[type=file]').setInputFiles(testPhotoPath);
  await page.waitForURL('**/studio', { timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, '03-studio-presets.png') });
  console.log('Saved 03-studio-presets.png');

  // Generate AI photo
  console.log('4. Generating AI photo to view Result...');
  await page.getByRole('button', { name: '과학 축제', exact: true }).click();
  await page.getByRole('button', { name: 'AI 사진 만들기', exact: true }).click();
  await page.getByRole('heading', { name: '완성!' }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '04-result-frame.png') });
  console.log('Saved 04-result-frame.png');

  // Before/after comparison
  console.log('5. Opening Before/After Comparison...');
  const compareBtn = page.getByRole('button', { name: '전후 비교', exact: true });
  if (await compareBtn.count()) {
    await compareBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, '05-comparison-slider.png') });
    console.log('Saved 05-comparison-slider.png');
    // return to frame view
    await page.getByRole('radio').first().click();
    await page.waitForTimeout(500);
  }

  // QR Transfer modal
  console.log('6. Opening QR Portal...');
  const qrBtn = page.getByRole('button', { name: /AR 라이브 포토 받기 \(QR\)|QR 다시 만들기/ });
  if (await qrBtn.count()) {
    await qrBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, '06-qr-portal.png') });
    console.log('Saved 06-qr-portal.png');
  }

  console.log('All screenshots captured successfully!');
} catch (err) {
  console.error('Error during capture:', err);
  process.exitCode = 1;
} finally {
  await browser.close();
}

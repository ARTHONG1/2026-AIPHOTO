async page => {
  const origin = typeof process !== 'undefined' && process.env.PHOTOBOOTH_TEST_ORIGIN || 'http://127.0.0.1:3012';
  const context = page.context();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.addInitScript(() => {
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Test camera disabled', 'NotAllowedError'));
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(kind, ...args) {
      if (window.__disablePortalWebGL && /webgl/.test(kind)) return null;
      return getContext.call(this, kind, ...args);
    };
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/booth');
  await page.getByText('카메라를 쓸 수 없어요. 사진을 올려서 시작할 수 있어요.').waitFor();
  const image = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 720; c.height = 1080;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#164e63'; ctx.fillRect(0, 0, 720, 1080);
    ctx.fillStyle = '#facc15'; ctx.fillRect(180, 200, 360, 500);
    return c.toDataURL('image/jpeg');
  });
  await context.route('**/studio', async route => {
    if (route.request().method() === 'POST' && route.request().headers()['next-action']) {
      await route.fulfill({ status: 200, contentType: 'text/x-component', body: '0:{"a":"$@1","f":"","b":"development"}\n1:' + JSON.stringify({ ok: true, image }) + '\n' });
    } else await route.continue();
  });
  await page.locator('input[type=file]').setInputFiles('.playwright-cli/synthetic.jpg');
  await page.waitForURL('**/studio');
  await page.getByRole('button', { name: '과학 축제', exact: true }).click();
  await page.getByRole('button', { name: 'AI 사진 만들기', exact: true }).click();
  await page.getByRole('heading', { name: '완성!' }).waitFor();
  await page.waitForLoadState('networkidle');
  const portal = page.getByTestId('qr-portal');
  const create = async () => {
    const response = page.waitForResponse(r => r.url() === origin + '/api/transfer' && r.request().method() === 'POST');
    await page.getByRole('button', { name: /AR 라이브 포토 받기 \(QR\)|QR 다시 만들기/ }).click();
    const room = await (await response).json();
    await portal.waitFor();
    return { room, url: origin + '/receive/' + room.id + '#' + room.receiverToken };
  };
  // Decode an actual screenshot, including the decorative rings, not the source image.
  const decodeScreen = async expected => {
    await page.addScriptTag({ path: 'node_modules/jsqr/dist/jsQR.js' });
    await portal.scrollIntoViewIfNeeded();
    const png = await portal.screenshot();
    const decoded = await page.evaluate(async base64 => {
      const img = new Image(); img.src = 'data:image/png;base64,' + base64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
      const pixels = ctx.getImageData(0, 0, c.width, c.height);
      return window.jsQR(pixels.data, c.width, c.height)?.data;
    }, png.toString('base64'));
    if (decoded !== expected) throw new Error('Rendered QR did not decode to the expected receive link');
  };
  let normal = await create();
  try {
    await page.waitForFunction(() => document.querySelector('[data-testid="qr-portal"]')?.dataset.intro === 'true', undefined, { timeout: 2500 });
  } catch {
    // A cold dev compiler / GPU can legitimately trigger the time-budget fallback.
    await decodeScreen(normal.url);
    normal = await create();
    await page.waitForFunction(() => document.querySelector('[data-testid="qr-portal"]')?.dataset.intro === 'true', undefined, { timeout: 3000 });
  }
  await portal.screenshot({ path: '.playwright-cli/portal-3d-intro.png' });
  await page.waitForFunction(() => document.querySelector('[data-testid="qr-portal"]')?.dataset.intro === 'false');
  await decodeScreen(normal.url);
  await portal.screenshot({ path: '.playwright-cli/portal-pc-ready.png' });
  await page.getByRole('button', { name: '기본 QR 보기', exact: true }).click();
  await decodeScreen(normal.url);
  await portal.screenshot({ path: '.playwright-cli/portal-plain-qr.png' });
  const skipped = await create();
  await page.waitForFunction(() => document.querySelector('[data-testid="qr-portal"]')?.dataset.intro === 'true');
  await page.getByRole('button', { name: '기본 QR 보기', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-testid="qr-portal"]')?.dataset.intro === 'false');
  await decodeScreen(skipped.url);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await create();
  await page.waitForTimeout(700);
  if (await portal.getAttribute('data-intro') !== 'false') throw new Error('Reduced motion started a 3D intro');
  await page.setViewportSize({ width: 390, height: 844 });
  await decodeScreen(reduced.url);
  await portal.screenshot({ path: '.playwright-cli/portal-mobile-ready.png' });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Mobile QR overflows');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => { window.__disablePortalWebGL = true; });
  const fallback = await create();
  await page.waitForTimeout(900);
  if (await portal.getAttribute('data-intro') !== 'false') throw new Error('Unavailable WebGL covered the QR');
  await decodeScreen(fallback.url);
  await portal.screenshot({ path: '.playwright-cli/portal-webgl-fallback.png' });
  await page.evaluate(() => { window.__disablePortalWebGL = false; });
  const lost = await create();
  await page.waitForFunction(() => document.querySelector('[data-testid="qr-portal"]')?.dataset.intro === 'true');
  await portal.locator('canvas').evaluate(canvas => canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await page.waitForFunction(() => document.querySelector('[data-testid="qr-portal"]')?.dataset.intro === 'false');
  await decodeScreen(lost.url);
  const separate = await context.browser().newContext({ viewport: { width: 390, height: 844 } });
  let releaseAnswer;
  let answerSeen;
  const heldAnswer = new Promise(resolve => { releaseAnswer = resolve; });
  const answerArrived = new Promise(resolve => { answerSeen = resolve; });
  await separate.route(origin + '/api/transfer/' + lost.room.id, async route => {
    if (JSON.parse(route.request().postData() || '{}').op === 'answer') { answerSeen(); await heldAnswer; }
    await route.continue();
  });
  const phone = await separate.newPage();
  phone.on('pageerror', error => errors.push(error.message));
  await phone.goto(lost.url);
  try {
    await Promise.race([answerArrived, new Promise((_, reject) => setTimeout(() => reject(new Error('Receiver did not negotiate')), 30000))]);
    await phone.screenshot({ path: '.playwright-cli/portal-phone-connecting.png', fullPage: true });
  } finally { releaseAnswer(); }
  await phone.getByRole('button', { name: '고화질 인쇄 사진 저장 (4×6)', exact: true }).waitFor({ timeout: 100000 });
  await page.getByText('휴대폰에 사진을 전달했어요!', { exact: true }).waitFor();
  if (await portal.getAttribute('data-status') !== 'received') throw new Error('Portal did not reflect actual receipt');
  await portal.screenshot({ path: '.playwright-cli/portal-pc-received.png' });
  await phone.screenshot({ path: '.playwright-cli/portal-phone-received.png', fullPage: true });
  const download = phone.waitForEvent('download');
  await phone.getByRole('button', { name: '고화질 인쇄 사진 저장 (4×6)', exact: true }).click();
  if (!(await (await download).path())) throw new Error('Received photo download failed');
  await separate.close();
  if (errors.length) throw new Error(errors.join('; '));
  return { intro: 'passed', renderedQrDecode: 'passed', plainQr: 'passed', skipIntro: 'passed', reducedMotion: 'passed', mobile: 'passed', webglUnavailable: 'passed', contextLost: 'passed', actualTransferAndDownload: 'passed', pageErrors: errors };
}

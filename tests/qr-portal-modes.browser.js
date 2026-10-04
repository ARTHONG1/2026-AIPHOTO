async page => {
  const origin = typeof process !== 'undefined' && process.env.PHOTOBOOTH_TEST_ORIGIN || 'http://127.0.0.1:3012';
  const context = page.context();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await context.addInitScript(() => {
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Test camera disabled', 'NotAllowedError'));
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(kind, ...args) {
      if (window.__disablePortalWebGL && /webgl/.test(kind)) return null;
      return getContext.call(this, kind, ...args);
    };
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/booth', { timeout: 60000 });
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
  const portal = page.getByTestId('qr-portal');
  const rendered = value => page.waitForFunction(value => document.querySelector('[data-testid="qr-portal"]')?.dataset.rendered === value, value, { timeout: 20000 });
  const create = async () => {
    const response = page.waitForResponse(r => r.url() === origin + '/api/transfer' && r.request().method() === 'POST');
    await page.getByRole('button', { name: /AR 라이브 포토 받기 \(QR\)|QR 다시 만들기/ }).click();
    const room = await (await response).json(); await portal.waitFor();
    return { room, url: origin + '/receive/' + room.id + '#' + room.receiverToken };
  };
  // Decodes the on-screen QR as captured, then again shrunk and blurred like a phone camera frame.
  const decode = async expected => {
    await page.addScriptTag({ path: 'node_modules/jsqr/dist/jsQR.js' });
    const png = await portal.screenshot();
    const decoded = await page.evaluate(async base64 => {
      const img = new Image(); img.src = 'data:image/png;base64,' + base64; await img.decode();
      return [[1, 'none'], [0.6, 'blur(1px)']].map(([scale, filter]) => {
        const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
        const ctx = c.getContext('2d'); ctx.filter = filter; ctx.drawImage(img, 0, 0, c.width, c.height);
        const pixels = ctx.getImageData(0, 0, c.width, c.height);
        return window.jsQR(pixels.data, c.width, c.height)?.data;
      });
    }, png.toString('base64'));
    if (decoded.some(value => value !== expected)) throw new Error('Screen QR failed to decode to its receive link: ' + JSON.stringify(decoded));
  };
  // The tree view must actually show foliage and grass, not an empty plot or the flat image.
  const treeDrawn = async () => {
    if (await portal.locator('canvas').evaluate(el => getComputedStyle(el).opacity) !== '1') throw new Error('Tree canvas is hidden');
    if (await portal.locator('img').evaluate(el => getComputedStyle(el).opacity) !== '0') throw new Error('Flat QR image is covering the tree');
    const png = await portal.screenshot();
    const green = await page.evaluate(async base64 => {
      const img = new Image(); img.src = 'data:image/png;base64,' + base64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0); const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 1] > d[i] + 25 && d[i + 1] > d[i + 2] + 25) n++;
      return n / (d.length / 4);
    }, png.toString('base64'));
    if (green < 0.04) throw new Error('Tree foliage is missing (' + green.toFixed(3) + ')');
  };
  const first = await create();
  await rendered('tree');
  await page.waitForTimeout(3000);
  if (await portal.getAttribute('data-rendered') !== 'tree') throw new Error('Tree did not persist with reduced motion');
  const box = await portal.boundingBox();
  if (!box || box.y < 0 || box.y + box.height > 1000) throw new Error('Initial tree is outside the viewport');
  await treeDrawn();
  await portal.screenshot({ path: '.playwright-cli/portal-tree.png' });
  await page.screenshot({ path: '.playwright-cli/portal-visible-on-create.png' });
  await portal.click(); await rendered('code'); await decode(first.url);
  if (await portal.locator('img').evaluate(el => getComputedStyle(el).opacity) !== '0') throw new Error('Code view fell back to the flat image');
  await portal.screenshot({ path: '.playwright-cli/portal-code.png' });
  await portal.click(); await rendered('tree'); await treeDrawn();
  await portal.focus(); await page.keyboard.press('Enter'); await rendered('code'); await decode(first.url);
  await portal.press('Space'); await rendered('tree');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: 'QR 코드 보기', exact: true }).last().click();
  await page.waitForTimeout(450);
  if (await portal.getAttribute('data-rendered') !== 'transition') throw new Error('Leaves did not animate into the code');
  await portal.screenshot({ path: '.playwright-cli/portal-morph.png' });
  await rendered('code');
  await page.getByRole('button', { name: '나무 다시 보기', exact: true }).last().click(); await rendered('tree');
  await page.waitForTimeout(2600);
  if (await portal.getAttribute('data-rendered') !== 'tree') throw new Error('Tree reverted automatically');
  await page.setViewportSize({ width: 390, height: 844 });
  await portal.scrollIntoViewIfNeeded(); await page.waitForTimeout(300); await treeDrawn();
  await portal.screenshot({ path: '.playwright-cli/portal-mobile-tree.png' });
  await portal.click(); await rendered('code'); await decode(first.url);
  await portal.screenshot({ path: '.playwright-cli/portal-mobile-code.png' });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Mobile layout overflows');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => { window.__disablePortalWebGL = true; });
  const fallback = await create(); await rendered('fallback'); await decode(fallback.url);
  await page.evaluate(() => { window.__disablePortalWebGL = false; });
  await page.getByRole('button', { name: '3D 다시 시도', exact: true }).last().click(); await rendered('tree');
  await portal.locator('canvas').evaluate(el => el.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await rendered('fallback'); await decode(fallback.url);
  await page.getByRole('button', { name: '3D 다시 시도', exact: true }).last().click(); await rendered('tree');
  // Repeated reversals must neither freeze the tree nor replace the QR room.
  for (let i = 0; i < 4; i++) { await portal.click(); await rendered(i % 2 === 0 ? 'code' : 'tree'); }
  // Reversing mid-flight must still come to rest.
  await portal.click(); await page.waitForTimeout(200); await portal.click(); await rendered('tree');
  await portal.click(); await rendered('code'); await decode(fallback.url);
  const phoneContext = await context.browser().newContext({ viewport: { width: 390, height: 844 } });
  const phone = await phoneContext.newPage(); phone.on('pageerror', e => errors.push(e.message));
  await phone.goto(fallback.url);
  await phone.getByRole('button', { name: '고화질 인쇄 사진 저장 (4×6)', exact: true }).waitFor({ timeout: 100000 });
  await page.getByText('휴대폰에 사진을 전달했어요!', { exact: true }).waitFor();
  await portal.click(); await rendered('tree');
  if (await portal.getAttribute('data-status') !== 'received') throw new Error('Receipt status was lost');
  await treeDrawn();
  await portal.screenshot({ path: '.playwright-cli/portal-received-tree.png' });
  await phone.screenshot({ path: '.playwright-cli/portal-phone-received.png', fullPage: true });
  const download = phone.waitForEvent('download');
  await phone.getByRole('button', { name: '고화질 인쇄 사진 저장 (4×6)', exact: true }).click();
  if (!(await (await download).path())) throw new Error('Photo download failed');
  await phoneContext.close();
  if (errors.length) throw new Error(errors.join('; '));
  return { treeDefault: 'passed', reducedMotionTree: 'passed', initiallyVisible: 'passed', leafMorph: 'passed', bidirectionalToggle: 'passed', keyboard: 'passed', renderedTreeCodeDecode: 'passed', degradedCameraDecode: 'passed', mobileResize: 'passed', webglFallbackAndRetry: 'passed', contextLossAndRetry: 'passed', midFlightReverse: 'passed', photoTransferAndDownload: 'passed', afterReceiveTree: 'passed', pageErrors: errors };
}

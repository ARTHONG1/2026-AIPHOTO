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
    // Count real Web Audio use so the tree's sound can be checked without speakers.
    window.__audio = []; window.__osc = 0;
    const NativeAudio = window.AudioContext;
    if (NativeAudio) {
      window.AudioContext = class extends NativeAudio { constructor(...args) { super(...args); window.__audio.push(this); } };
      const createOscillator = BaseAudioContext.prototype.createOscillator;
      BaseAudioContext.prototype.createOscillator = function() { window.__osc++; return createOscillator.call(this); };
    }
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
  // Before/after comparison: view only. Saving still downloads the framed final print.
  await page.getByRole('button', { name: '전후 비교', exact: true }).click();
  const slider = page.getByTestId('before-after');
  await slider.waitFor();
  if (!(await slider.locator('img').evaluateAll(imgs => imgs.length === 2 && imgs.every(img => img.complete && img.naturalWidth > 0)))) throw new Error('Comparison photos did not load');
  const sliderBox = await slider.boundingBox();
  if (!sliderBox || Math.abs(sliderBox.width / sliderBox.height - 0.8) > 0.02) throw new Error('Comparison is not 4:5: ' + JSON.stringify(sliderBox));
  const handle = page.getByRole('slider', { name: '변신 전후 비교' });
  if (await handle.getAttribute('aria-valuenow') !== '50') throw new Error('Comparison does not start in the middle');
  await handle.focus(); await page.keyboard.press('ArrowRight');
  if (await handle.getAttribute('aria-valuenow') !== '55') throw new Error('Arrow key did not move the comparison');
  await page.mouse.move(sliderBox.x + sliderBox.width * 0.5, sliderBox.y + sliderBox.height * 0.5);
  await page.mouse.down(); await page.mouse.move(sliderBox.x + sliderBox.width * 0.2, sliderBox.y + sliderBox.height * 0.5, { steps: 5 }); await page.mouse.up();
  if (Math.abs(Number(await handle.getAttribute('aria-valuenow')) - 20) > 2) throw new Error('Dragging did not move the comparison');
  await slider.screenshot({ path: '.playwright-cli/compare-booth.png' });
  const boothSave = page.waitForEvent('download');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  const boothFile = (await boothSave).suggestedFilename();
  if (!/^ai-hancut-festival-\d+\.jpg$/.test(boothFile)) throw new Error('Booth save is not the framed final print: ' + boothFile);
  await page.getByRole('radio').nth(1).click();
  if (await slider.count()) throw new Error('Choosing a frame did not return to the final photo');
  await page.getByRole('radio').first().click();
  const portal = page.getByTestId('qr-portal');
  const rendered = value => page.waitForFunction(value => document.querySelector('[data-testid="qr-portal"]')?.dataset.rendered === value, value, { timeout: 20000 });
  const create = async () => {
    const response = page.waitForResponse(r => r.url() === origin + '/api/transfer' && r.request().method() === 'POST');
    await page.getByRole('button', { name: /AR 라이브 포토 받기 \(QR\)|QR 다시 만들기/ }).click();
    const room = await (await response).json(); await portal.waitFor();
    return { room, url: origin + '/receive/' + room.id + '#' + room.receiverToken };
  };
  // The full-screen view fades in; capture only once it is fully opaque.
  const overlayStill = () => page.waitForFunction(() => { const d = document.querySelector('[role="dialog"]'); return !d || d.getAnimations().length === 0; }, null, { timeout: 5000 });
  // Decodes the on-screen QR as captured, then again shrunk and blurred like a phone camera frame.
  const decode = async expected => {
    await overlayStill();
    // Wait out the 0.25s crossfade between the tree canvas and the flat QR image.
    await page.waitForFunction(() => { const s = document.querySelector('[data-testid="qr-portal"]'); return [s.querySelector('img'), s.querySelector('canvas')].every(el => el.getAnimations().length === 0); }, null, { timeout: 5000 });
    // In the code view the glowing scan corners must be fully shown while decoding.
    if (await portal.getAttribute('data-rendered') === 'code') await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-testid="qr-portal"] [data-guide]')).opacity === '1', null, { timeout: 5000 });
    await page.addScriptTag({ path: 'node_modules/jsqr/dist/jsQR.js' });
    const png = await portal.screenshot();
    const decoded = await page.evaluate(async base64 => {
      const img = new Image(); img.src = 'data:image/png;base64,' + base64; await img.decode();
      return [[1, 'none'], [0.75, 'blur(1px)'], [0.6, 'blur(1px)']].map(([scale, filter]) => {
        const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
        const ctx = c.getContext('2d'); ctx.filter = filter; ctx.drawImage(img, 0, 0, c.width, c.height);
        const pixels = ctx.getImageData(0, 0, c.width, c.height);
        return window.jsQR(pixels.data, c.width, c.height)?.data;
      });
    }, png.toString('base64'));
    if (decoded.some(value => value !== expected)) throw new Error('Screen QR failed to decode to its receive link: ' + JSON.stringify(decoded));
  };
  // The tree view must actually show foliage and grass, not an empty plot or the flat image.
  const greenShare = async () => {
    const png = await portal.screenshot();
    return page.evaluate(async base64 => {
      const img = new Image(); img.src = 'data:image/png;base64,' + base64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0); const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 1] > d[i] + 25 && d[i + 1] > d[i + 2] + 25) n++;
      return n / (d.length / 4);
    }, png.toString('base64'));
  };
  const treeDrawn = async (min = 0.04) => {
    await overlayStill();
    // The canvas fades in over 0.25s once the scene has drawn.
    await page.waitForFunction(() => {
      const stage = document.querySelector('[data-testid="qr-portal"]');
      return stage && getComputedStyle(stage.querySelector('canvas')).opacity === '1' && getComputedStyle(stage.querySelector('img')).opacity === '0';
    }, null, { timeout: 5000 }).catch(() => { throw new Error('Tree canvas is hidden or covered by the flat QR'); });
    const png = await portal.screenshot();
    const green = await page.evaluate(async base64 => {
      const img = new Image(); img.src = 'data:image/png;base64,' + base64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0); const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 1] > d[i] + 25 && d[i + 1] > d[i + 2] + 25) n++;
      return n / (d.length / 4);
    }, png.toString('base64'));
    if (green < min) throw new Error('Tree foliage is missing (' + green.toFixed(3) + ')');
  };
  const dialog = page.getByRole('dialog', { name: 'QR 나무' });
  const view = async expected => { const value = await portal.getAttribute('data-view'); if (value !== expected) throw new Error('Expected ' + expected + ' tree view, got ' + value); };
  const guideOpacity = () => portal.locator('[data-guide]').evaluate(el => getComputedStyle(el).opacity);
  const first = await create();
  // The panel opens on the scannable QR with a short "tap the QR" cue; no full screen.
  await view('card'); await rendered('code');
  if (await dialog.count()) throw new Error('Full-screen tree opened without being asked');
  const box = await portal.boundingBox();
  if (!box || box.y < 0 || box.y + box.height > 1000) throw new Error('Initial QR is outside the viewport');
  await decode(first.url);
  if (await portal.locator('img').evaluate(el => getComputedStyle(el).opacity) !== '0') throw new Error('Initial QR is the flat fallback, not the tree plot');
  await page.getByRole('button', { name: 'QR을 눌러보세요', exact: true }).waitFor();
  await portal.screenshot({ path: '.playwright-cli/portal-card-code.png' });
  await page.screenshot({ path: '.playwright-cli/portal-visible-on-create.png' });
  await page.waitForTimeout(3000);
  if (await portal.getAttribute('data-rendered') !== 'code') throw new Error('QR did not stay on screen');
  await page.waitForFunction(() => window.__audio.at(-1)?.state === 'running', null, { timeout: 5000 }).catch(() => { throw new Error('Tree sound did not start'); });
  // Tapping the QR lifts the leaves into the tree, with a chord.
  const oscBefore = await page.evaluate(() => window.__osc);
  await portal.click();
  await page.waitForFunction(before => window.__osc >= before + 4, oscBefore, { timeout: 2000 }).catch(() => { throw new Error('Reveal chord did not play'); });
  await page.waitForTimeout(450);
  if (await portal.getAttribute('data-rendered') !== 'transition') throw new Error('QR did not animate into the tree');
  await portal.screenshot({ path: '.playwright-cli/portal-card-morph.png' });
  await rendered('tree'); await treeDrawn();
  if (await guideOpacity() !== '0') throw new Error('Scan guide shows over the tree');
  await page.getByRole('button', { name: 'QR 코드로 돌아가기', exact: true }).waitFor();
  await page.waitForTimeout(2600);
  if (await portal.getAttribute('data-rendered') !== 'tree') throw new Error('Tree reverted automatically');
  await portal.screenshot({ path: '.playwright-cli/portal-card-tree.png' });
  await portal.click(); await rendered('code'); await decode(first.url);
  await portal.focus(); await page.keyboard.press('Enter'); await rendered('tree');
  await portal.press('Space'); await rendered('code'); await decode(first.url);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: 'QR을 눌러보세요', exact: true }).click(); await rendered('tree');
  // Staff can mute the booth, and the choice is remembered for the next QR.
  await page.getByRole('button', { name: '소리 끄기', exact: true }).first().click();
  await page.waitForFunction(() => window.__audio.at(-1)?.state === 'closed' && localStorage.getItem('ai-hancut:qr-tree-sound') === 'off', null, { timeout: 5000 }).catch(() => { throw new Error('Mute did not stop the sound'); });
  const audioCount = await page.evaluate(() => window.__audio.length);
  await page.getByRole('button', { name: '소리 켜기', exact: true }).first().click();
  await page.waitForFunction(count => window.__audio.length === count + 1 && window.__audio.at(-1).state === 'running', audioCount, { timeout: 5000 }).catch(() => { throw new Error('Unmute did not restart the sound'); });
  // Opening full screen on the tree grows it in from the plot.
  await page.getByRole('button', { name: 'QR 나무 크게 보기', exact: true }).click();
  await dialog.waitFor(); await view('full');
  await rendered('growing'); await page.waitForTimeout(500);
  const early = await greenShare();
  await page.screenshot({ path: '.playwright-cli/portal-full-growing.png' });
  await rendered('tree');
  const grown = await greenShare();
  if (!(early < grown * 0.6)) throw new Error('Tree did not grow in (' + early.toFixed(3) + ' -> ' + grown.toFixed(3) + ')');
  if (!(await portal.evaluate(el => document.activeElement === el))) throw new Error('Tree stage did not receive focus');
  const fullBox = await portal.boundingBox();
  if (!fullBox || fullBox.width < 1300 || fullBox.height < 650) throw new Error('Full-screen tree is too small: ' + JSON.stringify(fullBox));
  await treeDrawn(0.02);
  await page.screenshot({ path: '.playwright-cli/portal-full-tree.png' });
  await page.getByRole('button', { name: '나무를 누르면 다시 QR 코드가 돼요', exact: true }).click(); await rendered('code'); await decode(first.url);
  await page.screenshot({ path: '.playwright-cli/portal-full-code.png' });
  await page.getByRole('button', { name: 'QR을 눌러보세요', exact: true }).last().click(); await rendered('tree');
  // Closing re-creates the panel tree on the tree view; tapping mid-growth skips straight to the QR.
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' }); await view('card');
  await rendered('growing'); await portal.click(); await rendered('code'); await decode(first.url);
  await page.getByRole('button', { name: 'QR 나무 크게 보기', exact: true }).click(); await dialog.waitFor(); await rendered('code'); await decode(first.url);
  await page.getByRole('button', { name: '닫기', exact: true }).click(); await dialog.waitFor({ state: 'detached' }); await view('card');
  await page.setViewportSize({ width: 390, height: 844 });
  await portal.scrollIntoViewIfNeeded(); await rendered('code'); await page.waitForTimeout(300); await decode(first.url);
  await portal.screenshot({ path: '.playwright-cli/portal-mobile-code.png' });
  await portal.click(); await rendered('tree'); await treeDrawn();
  await portal.screenshot({ path: '.playwright-cli/portal-mobile-tree.png' });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Mobile layout overflows');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => { window.__disablePortalWebGL = true; });
  const fallback = await create(); await view('card'); await rendered('fallback'); await decode(fallback.url);
  await page.evaluate(() => { window.__disablePortalWebGL = false; });
  await page.getByRole('button', { name: '3D 다시 시도', exact: true }).last().click(); await rendered('code'); await decode(fallback.url);
  await portal.locator('canvas').evaluate(el => el.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await rendered('fallback'); await decode(fallback.url);
  await page.getByRole('button', { name: '3D 다시 시도', exact: true }).last().click(); await rendered('code');
  // Repeated reversals must neither freeze the scene nor replace the QR room.
  for (let i = 0; i < 4; i++) { await portal.click(); await rendered(i % 2 === 0 ? 'tree' : 'code'); }
  // Reversing mid-flight must still come to rest.
  await portal.click(); await page.waitForTimeout(200); await portal.click(); await rendered('code'); await decode(fallback.url);
  const phoneContext = await context.browser().newContext({ viewport: { width: 390, height: 844 } });
  const phone = await phoneContext.newPage(); phone.on('pageerror', e => errors.push(e.message));
  await phone.goto(fallback.url);
  await phone.getByRole('button', { name: '고화질 인쇄 사진 저장 (4×6)', exact: true }).waitFor({ timeout: 100000 });
  // The phone shows the same comparison from a small display-only pair; saving stays the final photo.
  await phone.getByRole('button', { name: '변신 전후 비교 보기', exact: true }).click({ timeout: 15000 });
  const phoneSlider = phone.getByTestId('before-after');
  await phoneSlider.waitFor();
  const pairShape = await phoneSlider.locator('img').evaluateAll(imgs => imgs.map(img => img.naturalWidth / img.naturalHeight));
  if (pairShape.length !== 2 || pairShape.some(ratio => Math.abs(ratio - 0.8) > 0.01)) throw new Error('Phone comparison pair is not two 4:5 images: ' + JSON.stringify(pairShape));
  await phoneSlider.screenshot({ path: '.playwright-cli/compare-phone.png' });
  await page.getByText('휴대폰에 사진을 전달했어요!', { exact: true }).waitFor();
  await portal.click(); await rendered('tree');
  if (await portal.getAttribute('data-status') !== 'received') throw new Error('Receipt status was lost');
  await treeDrawn();
  await portal.screenshot({ path: '.playwright-cli/portal-received-tree.png' });
  await phone.screenshot({ path: '.playwright-cli/portal-phone-received.png', fullPage: true });
  const download = phone.waitForEvent('download');
  await phone.getByRole('button', { name: '고화질 인쇄 사진 저장 (4×6)', exact: true }).click();
  const savedPhoto = await download;
  if (!(await savedPhoto.path())) throw new Error('Photo download failed');
  if (!/^ai-hancut-[A-Za-z0-9_-]+\.jpg$/.test(savedPhoto.suggestedFilename())) throw new Error('Phone saved something other than the final photo: ' + savedPhoto.suggestedFilename());
  await phoneContext.close();
  await page.getByRole('button', { name: 'QR 나무 크게 보기', exact: true }).click(); await dialog.waitFor();
  await dialog.getByText('휴대폰에 사진을 전달했어요!', { exact: true }).waitFor();
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
  if (errors.length) throw new Error(errors.join('; '));
  return { boothCompare: 'passed', boothSaveStaysFinal: 'passed', phoneCompare: 'passed', phoneSaveStaysFinal: 'passed', qrFirstAndScannable: 'passed', tapCue: 'passed', noAutoFullScreen: 'passed', qrToTreeMorph: 'passed', revealChord: 'passed', scanGuideOnlyOnCode: 'passed', treeToQr: 'passed', keyboard: 'passed', muteRemembered: 'passed', growthIntroOnTreeOpen: 'passed', growthSkipOnTap: 'passed', optionalFullScreen: 'passed', degradedCameraDecode: 'passed', mobileCard: 'passed', webglFallbackAndRetry: 'passed', contextLossAndRetry: 'passed', midFlightReverse: 'passed', photoTransferAndDownload: 'passed', afterReceiveTree: 'passed', pageErrors: errors };
}

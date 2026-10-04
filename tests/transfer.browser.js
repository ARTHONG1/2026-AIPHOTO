async page => {
  const origin = typeof process !== 'undefined' && process.env.PHOTOBOOTH_TEST_ORIGIN || 'http://127.0.0.1:3012';
  const context = page.context();
  await context.addInitScript(() => {
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Camera disabled by test', 'NotAllowedError'));
  });
  // A slow phone must not lose a file selection made before React is ready.
  const cold = await context.newPage();
  let releaseScripts;
  const scriptsReady = new Promise(resolve => { releaseScripts = resolve; });
  await cold.route(url => url.pathname.startsWith('/_next/static/') && url.pathname.endsWith('.js'), async route => {
    await scriptsReady;
    await route.continue().catch(() => {});
  });
  try {
    await cold.goto(origin + '/receive', { waitUntil: 'commit', timeout: 60000 });
    const input = cold.locator('input[type=file]');
    await input.waitFor({ state: 'attached' });
    if (await input.isEnabled()) throw new Error('Photo selection is enabled before the receive screen is ready');
    releaseScripts();
    await cold.waitForFunction(() => !document.querySelector('input[type=file]').disabled);
    await input.setInputFiles('.playwright-cli/synthetic.jpg');
    await cold.getByRole('button', { name: 'AR 카메라', exact: true }).waitFor({ timeout: 30000 });
    console.log('PASS: photo selection waits for hydration');
  } finally { releaseScripts(); await cold.close(); }
  await page.goto(origin + '/booth', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.getByText('카메라를 쓸 수 없어요. 사진을 올려서 시작할 수 있어요.').waitFor({ timeout: 60000 });
  const image = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 720; c.height = 1080;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#164e63'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#facc15'; ctx.fillRect(180, 200, 360, 500);
    return c.toDataURL('image/jpeg', 0.9);
  });
  await context.route('**/studio', async route => {
    if (route.request().method() === 'POST' && route.request().headers()['next-action']) {
      const body = '0:{"a":"$@1","f":"","b":"development"}\n1:' + JSON.stringify({ ok: true, image }) + '\n';
      await route.fulfill({ status: 200, contentType: 'text/x-component', body });
    } else await route.continue();
  });
  await page.locator('input[type=file]').setInputFiles('.playwright-cli/synthetic.jpg');
  await page.waitForURL('**/studio', { timeout: 60000 });
  await page.getByRole('button', { name: '과학 축제', exact: true }).click();
  await page.getByRole('button', { name: 'AI 사진 만들기', exact: true }).click();
  await page.getByRole('heading', { name: '완성!' }).waitFor({ timeout: 60000 });
  console.log('PASS: result view');
  const roomResponse = page.waitForResponse(r => r.url() === origin + '/api/transfer' && r.request().method() === 'POST', { timeout: 30000 });
  await page.getByRole('button', { name: 'AR 라이브 포토 받기 (QR)' }).click();
  const room = await (await roomResponse).json();
  if (!room.id || !room.receiverToken) throw new Error('QR room not created');
  await page.getByAltText('AR 라이브 포토 QR 코드').waitFor();
  await page.getByAltText('AR 라이브 포토 QR 코드').scrollIntoViewIfNeeded();
  await page.getByAltText('AR 라이브 포토 QR 코드').evaluate(async el => { await Promise.all(el.parentElement.getAnimations().map(a => a.finished)); });
  await page.screenshot({ path: '.playwright-cli/qr-sender.png' });
  const separateContext = typeof process !== 'undefined';
  const phoneContext = separateContext ? await context.browser().newContext({ viewport: { width: 390, height: 844 } }) : context;
  await phoneContext.addInitScript(() => {
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Camera disabled by test', 'NotAllowedError'));
  });
  const phone = await phoneContext.newPage();
  await phone.setViewportSize({ width: 390, height: 844 });
  const photoLeaks = [];
  const signalStatuses = [];
  for (const p of [page, phone]) p.on('request', request => {
    if (request.url().includes('/api/transfer') && /data:image|photoUrl|"image"/.test(request.postData() || '')) photoLeaks.push('image in signaling request');
    if (/storage.googleapis.com\/.*\/photos\//.test(request.url()) || /\/api\/live\/.*\/photo/.test(request.url())) photoLeaks.push('legacy storage request');
  });
  page.on('response', response => {
    if (response.url().includes('/api/transfer/')) signalStatuses.push({ op: JSON.parse(response.request().postData() || '{}').op, status: response.status() });
  });
  const receiveUrl = origin + '/receive/' + room.id + '#' + room.receiverToken;
  await phone.goto(receiveUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try {
    await phone.getByRole('button', { name: '고화질 인쇄 사진 저장 (4×6)', exact: true }).waitFor({ timeout: 100000 });
  } catch (error) {
    await phone.screenshot({ path: '.playwright-cli/phone-failure.png', fullPage: true });
    throw new Error('Phone receive failed: ' + await phone.locator('body').innerText());
  }
  await page.getByText('휴대폰에 사진을 전달했어요!').waitFor({ timeout: 15000 });
  console.log('PASS: actual transfer and acknowledgment');
  await phone.screenshot({ path: '.playwright-cli/qr-phone-received.png', fullPage: true });
  const downloadPromise = phone.waitForEvent('download');
  await phone.getByRole('button', { name: '고화질 인쇄 사진 저장 (4×6)', exact: true }).click();
  const download = await downloadPromise;
  if (!(await download.path())) throw new Error('Phone download failed');
  await page.getByRole('link', { name: '처음으로', exact: true }).click();
  await page.waitForURL(origin + '/', { timeout: 30000 });
  if (!await phone.getByRole('button', { name: 'AR 카메라', exact: true }).isEnabled()) throw new Error('Phone AR lost after PC restart');
  const storage = await page.evaluate(() => ({ session: Object.values(sessionStorage), local: Object.values(localStorage) }));
  if (JSON.stringify(storage).includes('data:image')) throw new Error('Photo persisted in browser storage');
  const expired = await phoneContext.newPage();
  await expired.goto(receiveUrl, { waitUntil: 'domcontentloaded' });
  try { await expired.getByText(/연결이 만료됐어요/).waitFor({ timeout: 45000 }); }
  catch { throw new Error('Expired page: ' + await expired.locator('body').innerText() + ' owner signals=' + JSON.stringify(signalStatuses.slice(-8))); }
  await phone.getByRole('button', { name: '스티커 꾸미기', exact: true }).click();
  await phone.getByRole('button', { name: /스티커 붙이기/ }).first().click();
  await phone.screenshot({ path: '.playwright-cli/qr-phone-stickers.png', fullPage: true });
  await expired.goto(origin + '/receive', { waitUntil: 'domcontentloaded' });
  await expired.getByText('선택한 사진은 서버에 업로드하지 않습니다.').waitFor();
  await expired.waitForFunction(() => {
    const input = document.querySelector('input[type=file]');
    return input && !input.disabled;
  });
  await expired.locator('input[type=file]').setInputFiles('.playwright-cli/synthetic.jpg');
  await expired.getByRole('button', { name: 'AR 카메라', exact: true }).waitFor({ timeout: 30000 });
  await expired.getByRole('button', { name: 'AR 카메라', exact: true }).click();
  await expired.getByRole('dialog', { name: 'AR 카메라', exact: true }).waitFor();
  await expired.getByText('카메라를 쓸 수 없어요', { exact: true }).waitFor({ timeout: 30000 });
  await expired.screenshot({ path: '.playwright-cli/qr-local-ar.png' });
  // Hold the receiver answer to make cancellation deterministic (no real photo sent).
  await page.goto(origin + '/booth', { waitUntil: 'domcontentloaded' });
  await page.getByText('카메라를 쓸 수 없어요. 사진을 올려서 시작할 수 있어요.').waitFor();
  await page.locator('input[type=file]').setInputFiles('.playwright-cli/synthetic.jpg');
  await page.waitForURL('**/studio');
  await page.getByRole('button', { name: '과학 축제', exact: true }).click();
  await page.getByRole('button', { name: 'AI 사진 만들기', exact: true }).click();
  await page.getByRole('heading', { name: '완성!' }).waitFor();
  const nextRoomResponse = page.waitForResponse(r => r.url() === origin + '/api/transfer' && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'AR 라이브 포토 받기 (QR)' }).click();
  const nextRoom = await (await nextRoomResponse).json();
  let releaseAnswer;
  const heldAnswer = new Promise(resolve => { releaseAnswer = resolve; });
  let answerSeen;
  const answerArrived = new Promise(resolve => { answerSeen = resolve; });
  await phoneContext.route(origin + '/api/transfer/' + nextRoom.id, async route => {
    if (JSON.parse(route.request().postData() || '{}').op === 'answer') { answerSeen(); await heldAnswer; }
    await route.continue();
  });
  const interrupted = await phoneContext.newPage();
  await interrupted.goto(origin + '/receive/' + nextRoom.id + '#' + nextRoom.receiverToken, { waitUntil: 'domcontentloaded' });
  await Promise.race([answerArrived, new Promise((_, reject) => setTimeout(() => reject(new Error('Receiver did not negotiate')), 30000))]);
  await page.getByText('사진 전달 중에는 자동으로 돌아가지 않아요').waitFor();
  await page.getByRole('link', { name: '처음으로', exact: true }).click();
  await page.waitForURL(origin + '/');
  releaseAnswer();
  await interrupted.getByText(/연결이 만료됐어요|전송이 중단됐어요/).waitFor({ timeout: 30000 });
  if (await interrupted.getByRole('button', { name: '고화질 인쇄 사진 저장 (4×6)', exact: true }).count()) throw new Error('Interrupted receiver got a photograph');
  if (photoLeaks.length) throw new Error(photoLeaks.join(', '));
  console.log('PASS: actual DataChannel transfer, receiver acknowledgment, phone download, PC restart, expired QR, phone stickers, local photo reopening, AR permission handling and interrupted transfer; no photo upload/storage requests.');
  await phone.close(); await expired.close(); await interrupted.close();
  if (separateContext) await phoneContext.close();
  return { transfer: 'passed', acknowledgment: 'passed', restart: 'passed', localAR: 'passed', interruptedTransfer: 'passed', photoLeaks };
}

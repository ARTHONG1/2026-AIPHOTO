#!/usr/bin/env node
// Builds the print-frame overlays offered on the result screen.
//   node scripts/build-frames.mjs          -> public/frames/{id}.webp, thumb/{id}.webp, fonts/*.woff2
//   node scripts/build-frames.mjs --sheet  -> also writes a contact sheet to $TEMP/frame-sheet.jpg
// Each frame is laid out in HTML at print size (1200x1800 = 4x6 in at 300 dpi) and captured with
// headless Chrome, then the photo window from src/lib/frames.ts is cut out of it. Needs Google
// Chrome (or CHROME_PATH) and Python with fontTools + brotli for the date font subsets.
import { execFile, execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { DATE_CHARACTERS, FRAMES, PRINT } from '../src/lib/frames.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FONTS = join(ROOT, 'assets-src', 'fonts');
const OUT = join(ROOT, 'public', 'frames');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const { width: W, height: H } = PRINT;
const url = (p) => pathToFileURL(p).href;
const run = promisify(execFile);

// ---------- festival lockup from the official poster ----------
// The poster title sits on flat navy (0,22,79), so it can be keyed out cleanly.
async function festivalAssets(tmp) {
  const poster = join(ROOT, 'assets-src', 'frames', 'poster-28th.jpg');
  const L = 150, T = 205, CW = 1975, CH = 780;
  const { data } = await sharp(poster).extract({ left: L, top: T, width: CW, height: CH }).raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(CW * CH * 4);
  const yellow = (i) => data[i] > 190 && data[i + 1] > 150 && data[i + 2] < 130;
  for (let y = 0; y < CH; y++) {
    const py = y + T;
    // Ribbon rows: fill everything between its yellow edges so the navy text stays opaque.
    let rl = -1, rr = -1;
    if (py > 760) for (let x = 0; x < CW; x++) if (yellow((y * CW + x) * 3)) { if (rl < 0) rl = x; rr = x; }
    for (let x = 0; x < CW; x++) {
      const i = (y * CW + x) * 3, o = (y * CW + x) * 4, px = x + L;
      const d = Math.hypot(data[i], data[i + 1] - 22, data[i + 2] - 79);
      let a = Math.max(0, Math.min(1, (d - 14) / 26));
      if (px > 2012 && py < 480) a = 0; // satellite
      if (py > 760) a = rl >= 0 && x >= rl - 2 && x <= rr + 2 ? Math.max(a, x >= rl + 4 && x <= rr - 4 ? 1 : a) : 0;
      rgba[o] = data[i]; rgba[o + 1] = data[i + 1]; rgba[o + 2] = data[i + 2]; rgba[o + 3] = Math.round(a * 255);
    }
  }
  const lockup = join(tmp, 'lockup.png');
  await sharp(rgba, { raw: { width: CW, height: CH, channels: 4 } }).trim({ threshold: 1 }).png().toFile(lockup);
  // Girl, robot and the future city from the poster art for the bottom band.
  const scene = join(tmp, 'scene.jpg');
  await sharp(poster).extract({ left: 860, top: 1560, width: 1620, height: 900 }).jpeg({ quality: 95 }).toFile(scene);
  return { lockup: url(lockup), scene: url(scene) };
}

// ---------- shared markup ----------
const FONT_FACES = [
  ['Jua', 'Jua-Regular.ttf'],
  ['BlackHan', 'BlackHanSans-Regular.ttf'],
  ['DoHyeon', 'DoHyeon-Regular.ttf'],
  ['Pen', 'NanumPenScript-Regular.ttf'],
  ['MyeongjoXB', 'NanumMyeongjo-ExtraBold.ttf'],
  ['Orbitron', 'Orbitron.ttf', '400 900'],
  ['Noto', 'NotoSansKR.ttf', '100 900'],
  ['Neodgm', 'neodgm.ttf'],
  ['PressStart', 'PressStart2P-Regular.ttf'],
  ['Dseg', 'DSEG7Classic-Bold.ttf'],
]
  .map(([family, file, weight]) => '@font-face{font-family:' + family + ';src:url("' + url(join(FONTS, file)) + '");' + (weight ? 'font-weight:' + weight + ';' : '') + '}')
  .join('\n');

// Deterministic star field so rebuilding gives identical files.
function stars(count, seed, colors, maxSize = 4) {
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  let out = '';
  for (let i = 0; i < count; i++) {
    const r = 0.6 + rnd() ** 3 * maxSize;
    const c = colors[Math.floor(rnd() * colors.length)];
    out += '<circle cx="' + (rnd() * W).toFixed(1) + '" cy="' + (rnd() * H).toFixed(1) + '" r="' + r.toFixed(2) + '" fill="' + c + '" opacity="' + (0.35 + rnd() * 0.65).toFixed(2) + '"/>';
  }
  return '<svg class="abs" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' + out + '</svg>';
}

const barcode = (w, h, color, seed = 7) => {
  let s = seed, x = 0, bars = '';
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  while (x < w - 4) {
    const bw = 2 + Math.floor(rnd() * 3) * 2;
    if (rnd() > 0.35) bars += '<rect x="' + x + '" y="0" width="' + bw + '" height="' + h + '" fill="' + color + '"/>';
    x += bw + 2;
  }
  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' + bars + '</svg>';
};

// Frame artwork. "base" is drawn behind the photo (the window is cut out afterwards);
// "top" is drawn over the photo. Keep text at least 45 px from the edges: borderless
// photo printers trim about 2-3 % of each side.
function frameMarkup(f, assets) {
  const p = f.photo;
  const win = 'left:' + p.x + 'px;top:' + p.y + 'px;width:' + p.w + 'px;height:' + p.h + 'px;border-radius:' + p.r + 'px;';
  switch (f.id) {
    case 'festival':
      return {
        css: `
          .bg{background:#00164f}
          .scene{left:440px;top:1360px;width:760px;height:440px;background:url("${assets.scene}") center 30%/cover;
            -webkit-mask-image:linear-gradient(90deg,transparent 0,#000 46%),linear-gradient(180deg,transparent 0,#000 60px);-webkit-mask-composite:source-in}
          .shade{left:0;top:1360px;width:1200px;height:440px;background:linear-gradient(90deg,rgb(0 22 79/.92) 0,rgb(0 22 79/.55) 55%,rgb(0 22 79/.1) 100%)}
          .ring{${win}box-shadow:0 0 0 4px rgb(120 190 255/.55),0 18px 50px rgb(0 0 0/.45)}
          .lockup{left:52px;top:1418px;width:900px;filter:drop-shadow(0 0 3px #00164f) drop-shadow(0 0 8px #00164f) drop-shadow(0 6px 16px rgb(0 0 0/.55))}
          .head{left:62px;top:44px;font:700 44px Noto;color:#fff;letter-spacing:-1px}
          .head b{color:#ffd23f}
          .info{right:62px;top:56px;font:500 26px Noto;color:#a9c8f5;text-align:right}`,
        base: `<div class="abs bg" style="inset:0"></div><div class="abs scene"></div><div class="abs shade"></div><div class="abs ring"></div>
          <div class="abs head">AI <b>미래 사진관</b></div><div class="abs info">2026. 10. 23.~24. 인천아시아드주경기장</div>
          <img class="abs lockup" src="${assets.lockup}">`,
        top: '',
      };
    case 'simple':
      return {
        css: `
          .bg{background:#fbfaf7}
          .ring{${win}box-shadow:0 10px 30px rgb(27 31 59/.12)}
          .logo{left:70px;top:54px;font:64px Jua;color:#1b1f3b;line-height:1}
          .t1{left:0;right:0;top:1540px;text-align:center;font:700 46px Noto;color:#1b1f3b;letter-spacing:-1px}
          .t2{left:0;right:0;top:1612px;text-align:center;font:500 28px Noto;color:#8a8da6}
          .ice{left:50%;top:1668px;height:84px;transform:translateX(-50%)}`,
        base: `<div class="abs bg" style="inset:0"></div><div class="abs ring"></div><div class="abs logo">AI한컷</div>
          <div class="abs t1">AI와 함께 만든 과학 사진</div><div class="abs t2">제28회 인천과학대제전 · AI 미래 사진관</div>
          <img class="abs ice" src="${assets.ice}">`,
        top: '',
      };
    case 'film': {
      let holes = '';
      for (let y = 60; y < H - 60; y += 112) holes += '<div class="abs hole" style="left:42px;top:' + y + 'px"></div><div class="abs hole" style="left:1106px;top:' + y + 'px"></div>';
      return {
        css: `
          .bg{background:#121212}
          .hole{width:52px;height:74px;border-radius:9px;background:#efe8d8}
          .edge{font:700 30px Orbitron;color:#ff9a2e;letter-spacing:4px}
          .t1{left:0;right:0;top:1575px;text-align:center;font:60px DoHyeon;color:#f5f1e6;letter-spacing:2px}
          .t2{left:0;right:0;top:1665px;text-align:center;font:500 30px Noto;color:#a8a39a;letter-spacing:6px}`,
        base: `<div class="abs bg" style="inset:0"></div>${holes}
          <div class="abs edge" style="left:130px;top:128px">HANCUT 400</div><div class="abs edge" style="right:130px;top:128px">▶ 28A</div>
          <div class="abs edge" style="left:130px;top:1532px;font-size:24px">▶ 28</div><div class="abs edge" style="right:130px;top:1532px;font-size:24px">SCIENCE 28</div>
          <div class="abs t1">AI한컷 · 과학대제전</div><div class="abs t2">INCHEON SCIENCE FESTIVAL</div>`,
        top: '',
      };
    }
    case 'space':
      return {
        css: `
          .bg{background:radial-gradient(70% 45% at 85% 8%,rgb(120 60 220/.55),transparent 70%),radial-gradient(60% 40% at 5% 95%,rgb(20 160 220/.45),transparent 70%),linear-gradient(180deg,#070a24,#0d0b33 55%,#050716)}
          .planet{left:1030px;top:-40px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ffd9a8,#e0843f 55%,#6b2a12 100%);box-shadow:0 0 60px rgb(255 160 90/.45)}
          .ringp{left:975px;top:36px;width:300px;height:54px;border-radius:50%;border:8px solid rgb(255 220 170/.75);transform:rotate(-14deg);border-bottom-color:transparent}
          .moon{left:40px;top:1560px;width:110px;height:110px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#e9f1ff,#8fa2c8 60%,#3a4670)}
          .k1{left:0;right:0;top:60px;text-align:center;font:700 34px Orbitron;color:#8fe9ff;letter-spacing:12px}
          .k2{left:0;right:0;top:108px;text-align:center;font:108px BlackHan;line-height:1.2;background:linear-gradient(180deg,#fff,#9eeaff 60%,#4fb6ff);-webkit-background-clip:text;color:transparent;filter:drop-shadow(0 0 22px rgb(80 200 255/.55))}
          .ring{${win}box-shadow:0 0 0 5px #8fe9ff,0 0 40px 6px rgb(80 200 255/.55)}
          .br{width:70px;height:70px;border-color:#8fe9ff;border-style:solid;border-width:0}
          .t1{left:0;right:0;top:1582px;text-align:center;font:700 44px Noto;color:#fff;letter-spacing:-1px}
          .t2{left:0;right:0;top:1650px;text-align:center;font:500 26px Orbitron;color:#9fb4ff;letter-spacing:8px}`,
        base: `<div class="abs bg" style="inset:0"></div>${stars(420, 28, ['#ffffff', '#cfe8ff', '#ffe9c4'], 3.2)}
          <div class="abs planet"></div><div class="abs ringp"></div><div class="abs moon"></div>
          <div class="abs k1">SPACE MISSION</div><div class="abs k2">우주 탐험 대원</div><div class="abs ring"></div>
          <div class="abs br" style="left:${p.x - 26}px;top:${p.y - 26}px;border-top-width:6px;border-left-width:6px"></div>
          <div class="abs br" style="left:${p.x + p.w - 44}px;top:${p.y - 26}px;border-top-width:6px;border-right-width:6px"></div>
          <div class="abs br" style="left:${p.x - 26}px;top:${p.y + p.h - 44}px;border-bottom-width:6px;border-left-width:6px"></div>
          <div class="abs br" style="left:${p.x + p.w - 44}px;top:${p.y + p.h - 44}px;border-bottom-width:6px;border-right-width:6px"></div>
          <div class="abs t1">미래의 우주 과학자</div><div class="abs t2">AI HANCUT · INCHEON</div>`,
        top: '',
      };
    case 'lab':
      return {
        css: `
          .bg{background:repeating-linear-gradient(180deg,transparent 0 58px,#c9d8f0 58px 60px),#fdf8ec}
          .margin{left:92px;top:0;width:3px;height:1800px;background:#e8a0a0}
          .title{left:130px;top:110px;font:132px Pen;color:#233a8b;line-height:1}
          .sub{left:300px;top:240px;font:50px Pen;color:#5d6fa8}
          .ring{${win}box-shadow:0 0 0 22px #fff,0 16px 36px 18px rgb(35 58 139/.16)}
          .tape{width:230px;height:62px;background:rgb(255 226 130/.78);box-shadow:0 2px 6px rgb(0 0 0/.12)}
          .res{left:130px;top:1578px;font:86px Pen;color:#233a8b;line-height:1}
          .obs{left:130px;top:1690px;font:52px Pen;color:#5d6fa8}
          .doodle{left:960px;top:96px}`,
        base: `<div class="abs bg" style="inset:0"></div><div class="abs margin"></div>
          <div class="abs title">나의 과학 실험 노트</div><div class="abs sub">관찰 대상: AI가 찍어 준 미래의 나</div><div class="abs ring"></div>
          <svg class="abs doodle" width="170" height="170" viewBox="0 0 100 100" fill="none" stroke="#233a8b" stroke-width="3.2" stroke-linecap="round">
            <ellipse cx="50" cy="50" rx="44" ry="16"/><ellipse cx="50" cy="50" rx="44" ry="16" transform="rotate(60 50 50)"/><ellipse cx="50" cy="50" rx="44" ry="16" transform="rotate(120 50 50)"/><circle cx="50" cy="50" r="6" fill="#e05a5a" stroke="none"/></svg>
          <div class="abs res">실험 결과: 대성공! ★</div><div class="abs obs">관찰자: ____________</div>`,
        top: `<div class="abs tape" style="left:${p.x - 70}px;top:${p.y - 28}px;transform:rotate(-32deg)"></div>
          <div class="abs tape" style="left:${p.x + p.w - 160}px;top:${p.y - 28}px;transform:rotate(32deg)"></div>`,
      };
    case 'id-card':
      return {
        css: `
          .bg{background:linear-gradient(180deg,#eef4ff,#d6e4ff)}
          .head{left:0;top:0;width:1200px;height:320px;background:linear-gradient(135deg,#12305c,#1f56a8)}
          .slot{left:520px;top:48px;width:160px;height:30px;border-radius:15px;background:#eef4ff}
          .k1{left:0;right:0;top:118px;text-align:center;font:700 28px Orbitron;color:#8fc3ff;letter-spacing:8px}
          .k2{left:0;right:0;top:166px;text-align:center;font:92px BlackHan;color:#fff;line-height:1.1}
          .ring{${win}box-shadow:0 0 0 10px #fff,0 14px 34px 10px rgb(18 48 92/.2)}
          .lab{font:700 30px Noto;color:#6b7fa8}
          .val{font:700 36px Noto;color:#12305c}
          .line{height:3px;background:#9fb2d6}
          .code{left:840px;top:1628px}`,
        base: `<div class="abs bg" style="inset:0"></div><div class="abs head"></div><div class="abs slot"></div>
          <div class="abs k1">FUTURE SCIENTIST</div><div class="abs k2">미래 과학자 신분증</div><div class="abs ring"></div>
          <div class="abs lab" style="left:170px;top:1500px">이름</div><div class="abs line" style="left:330px;top:1546px;width:700px"></div>
          <div class="abs lab" style="left:170px;top:1580px">소속</div><div class="abs val" style="left:330px;top:1574px">인천과학대제전 AI 연구소</div>
          <div class="abs lab" style="left:170px;top:1660px">발급</div>
          <div class="abs code">${barcode(190, 80, '#12305c')}</div>`,
        top: '',
      };
    case 'magazine':
      return {
        css: `
          .band{left:0;top:0;width:1200px;height:290px;background:#c8102e}
          .mast{left:44px;top:62px;font:210px MyeongjoXB;color:#fff;line-height:1;letter-spacing:-6px}
          .issue{left:60px;top:44px;font:700 30px Noto;color:#ffd6dc}
          .fade{left:0;top:1260px;width:1200px;height:540px;background:linear-gradient(180deg,transparent,rgb(0 0 0/.72))}
          .c1{left:60px;top:1500px;font:96px BlackHan;color:#fff;line-height:1;text-shadow:0 4px 18px rgb(0 0 0/.5)}
          .c2{left:62px;top:1616px;font:700 46px Noto;color:#ffd84d;text-shadow:0 3px 12px rgb(0 0 0/.5)}
          .c3{left:62px;top:1686px;font:500 32px Noto;color:#fff}
          .tag{left:880px;top:330px;width:250px;height:250px;border-radius:50%;background:#ffd84d;color:#c8102e;display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(12deg);box-shadow:0 8px 24px rgb(0 0 0/.3)}
          .tag b{font:84px BlackHan;line-height:1}.tag span{font:700 30px Noto}`,
        base: `<div class="abs band"></div><div class="abs mast">SCIENCE</div>`,
        top: `<div class="abs fade"></div><div class="abs c1">올해의 과학 인물</div><div class="abs c2">AI가 그린 나의 미래 모습</div>
          <div class="abs c3">제28회 인천과학대제전 현장 인터뷰</div><div class="abs tag"><span>특별호</span><b>AI</b><span>한컷</span></div>`,
      };
    case 'neon':
      return {
        css: `
          .bg{background:radial-gradient(60% 40% at 50% 0,rgb(160 40 200/.45),transparent 70%),radial-gradient(50% 35% at 50% 100%,rgb(40 120 255/.35),transparent 70%),
            repeating-linear-gradient(0deg,rgb(255 255 255/.025) 0 2px,transparent 2px 60px),repeating-linear-gradient(90deg,rgb(255 255 255/.025) 0 2px,transparent 2px 120px),#0b0616}
          .k1{left:0;right:0;top:56px;text-align:center;font:700 34px Orbitron;color:#bff8ff;letter-spacing:12px;text-shadow:0 0 8px #3ee8ff,0 0 22px #3ee8ff}
          .k2{left:0;right:0;top:92px;text-align:center;font:156px Jua;color:#fff0fb;line-height:1.1;text-shadow:0 0 6px #fff,0 0 18px #ff4fd8,0 0 42px #ff4fd8,0 0 80px #ff4fd8}
          .ring{${win}box-shadow:0 0 0 6px #b9fbff,0 0 18px 8px rgb(62 232 255/.85),0 0 70px 16px rgb(62 232 255/.4)}
          .t1{left:0;right:0;top:1578px;text-align:center;font:700 46px Noto;color:#ffe3fa;text-shadow:0 0 10px #ff4fd8,0 0 30px #ff4fd8}`,
        base: `<div class="abs bg" style="inset:0"></div><div class="abs k1">SCIENCE NIGHT</div><div class="abs k2">AI 한컷</div>
          <div class="abs ring"></div><div class="abs t1">제28회 인천과학대제전</div>`,
        top: '',
      };
    case 'pixel': {
      const heart = (x, y) => {
        const rows = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'];
        let cells = '';
        rows.forEach((r, j) => [...r].forEach((c, i) => { if (c === '1') cells += '<rect x="' + i + '" y="' + j + '" width="1" height="1"/>'; }));
        return '<svg class="abs" style="left:' + x + 'px;top:' + y + 'px" width="56" height="48" viewBox="0 0 7 6" fill="#ff004d" shape-rendering="crispEdges">' + cells + '</svg>';
      };
      return {
        css: `
          .bg{background:#1d2b53}
          .hud{font:30px PressStart;color:#fff1e8}
          .title{left:0;right:0;top:150px;text-align:center;font:112px Neodgm;color:#ffec27;text-shadow:6px 6px 0 #7e2553}
          .ring{${win}box-shadow:0 0 0 10px #fff1e8,0 0 0 20px #000,0 0 0 30px #29adff}
          .t1{left:0;right:0;top:1552px;text-align:center;font:56px Neodgm;color:#fff1e8}
          .t2{left:0;right:0;top:1636px;text-align:center;font:30px PressStart;color:#ffec27}
          .t3{left:100px;top:1690px;font:52px Neodgm;color:#ff77a8}`,
        base: `<div class="abs bg" style="inset:0"></div>${stars(90, 5, ['#fff1e8', '#29adff', '#ffec27'], 2.5).replaceAll('<circle', '<circle shape-rendering="crispEdges"')}
          <div class="abs hud" style="left:100px;top:64px;color:#ff004d">1UP</div><div class="abs hud" style="left:330px;top:64px">SCORE 002028</div>
          ${heart(900, 56)}${heart(970, 56)}${heart(1040, 56)}
          <div class="abs title">과학자 등장!</div><div class="abs ring"></div>
          <div class="abs t1">STAGE 28 · 인천과학대제전</div><div class="abs t2">PRESS START</div><div class="abs t3">AI한컷</div>`,
        top: '',
      };
    }
    case 'himchan':
      return {
        css: `
          .bg{background:linear-gradient(180deg,#bfe6ff,#eef9ff 70%,#fff8e6)}
          .cloud{background:#fff;border-radius:999px;filter:blur(2px);opacity:.95}
          .title{left:0;right:0;top:78px;text-align:center;font:104px Jua;color:#2a5bb8;line-height:1.1;text-shadow:0 5px 0 #fff,5px 0 0 #fff,-5px 0 0 #fff,0 -5px 0 #fff,0 10px 18px rgb(42 91 184/.25)}
          .ring{${win}box-shadow:0 0 0 16px #fff,0 18px 40px 16px rgb(42 91 184/.22)}
          .t1{left:84px;top:1568px;font:54px Jua;color:#2a5bb8}
          .hc{left:858px;top:1316px;width:320px;filter:drop-shadow(0 10px 16px rgb(42 91 184/.35))}`,
        base: `<div class="abs bg" style="inset:0"></div>
          <div class="abs cloud" style="left:-60px;top:40px;width:300px;height:110px"></div><div class="abs cloud" style="left:980px;top:170px;width:280px;height:96px"></div>
          <div class="abs cloud" style="left:-40px;top:1620px;width:260px;height:90px;opacity:.7"></div>
          <div class="abs title">힘찬이와 과학 한 컷!</div><div class="abs ring"></div><div class="abs t1">AI한컷 · 인천과학대제전</div>`,
        top: `<img class="abs hc" src="${assets.himchan}">`,
      };
    default:
      throw new Error('No artwork for frame ' + f.id);
  }
}

function page(f, assets) {
  const m = frameMarkup(f, assets);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${FONT_FACES}
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:transparent}
.abs{position:absolute}
.layer{position:absolute;inset:0}
body.base .top,body.top .base{display:none}
${m.css}
</style></head><body><div class="layer base">${m.base}</div><div class="layer top">${m.top}</div>
<script>document.body.className=new URLSearchParams(location.search).get('layer')||'base'</script></body></html>`;
}

async function capture(html, layer, out) {
  await run(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', '--force-device-scale-factor=1',
    '--default-background-color=00000000', '--window-size=' + W + ',' + H, '--virtual-time-budget=6000',
    '--screenshot=' + out, url(html) + '?layer=' + layer,
  ]);
  const meta = await sharp(out).metadata();
  if (meta.width !== W || meta.height !== H) throw new Error('Unexpected capture size ' + meta.width + 'x' + meta.height);
}

async function buildFrame(f, assets, tmp) {
  const html = join(tmp, f.id + '.html');
  await writeFile(html, page(f, assets));
  const basePng = join(tmp, f.id + '-base.png');
  const topPng = join(tmp, f.id + '-top.png');
  await Promise.all([capture(html, 'base', basePng), capture(html, 'top', topPng)]);
  const p = f.photo;
  const hole = Buffer.from('<svg width="' + W + '" height="' + H + '"><rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" rx="' + p.r + '" fill="#000"/></svg>');
  const cut = await sharp(basePng).ensureAlpha().composite([{ input: hole, blend: 'dest-out' }]).png().toBuffer();
  const overlay = await sharp(cut).composite([{ input: topPng }]).png().toBuffer();
  await sharp(overlay).webp({ quality: 90, alphaQuality: 100, effort: 5 }).toFile(join(OUT, f.id + '.webp'));
  await sharp(overlay).resize(240, 360).webp({ quality: 82, alphaQuality: 90 }).toFile(join(OUT, 'thumb', f.id + '.webp'));
  return overlay;
}

// Date fonts: only the characters formatFrameDate can produce, as small woff2 files.
function buildDateFonts(tmp) {
  const fonts = {
    sans: ['NotoSansKR.ttf', 700],
    jua: ['Jua-Regular.ttf'],
    orbitron: ['Orbitron.ttf', 700],
    dseg: ['DSEG7Classic-Bold.ttf'],
    pixel: ['neodgm.ttf'],
    pen: ['NanumPenScript-Regular.ttf'],
  };
  for (const [id, [file, weight]] of Object.entries(fonts)) {
    let src = join(FONTS, file);
    if (weight) {
      const pinned = join(tmp, id + '-static.ttf');
      execFileSync('python', ['-m', 'fontTools.varLib.instancer', src, 'wght=' + weight, '-q', '-o', pinned]);
      src = pinned;
    }
    execFileSync('python', ['-m', 'fontTools.subset', src, '--text=' + DATE_CHARACTERS, '--flavor=woff2', '--layout-features=*', '--output-file=' + join(OUT, 'fonts', id + '.woff2')]);
  }
}

async function contactSheet(overlays) {
  const tw = 300, th = 450, cols = 5;
  const sample = await sharp({ create: { width: tw, height: th, channels: 3, background: '#8aa0b8' } }).png().toBuffer();
  const tiles = await Promise.all(
    overlays.map(async (o, i) => ({
      input: await sharp(sample).composite([{ input: await sharp(o).resize(tw, th).png().toBuffer() }]).png().toBuffer(),
      left: (i % cols) * tw,
      top: Math.floor(i / cols) * th,
    }))
  );
  const out = join(tmpdir(), 'frame-sheet.jpg');
  await sharp({ create: { width: cols * tw, height: Math.ceil(overlays.length / cols) * th, channels: 3, background: '#222' } }).composite(tiles).jpeg({ quality: 85 }).toFile(out);
  console.log('sheet:', out);
}

if (!existsSync(CHROME)) throw new Error('Chrome not found. Set CHROME_PATH.');
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const tmp = await mkdtemp(join(tmpdir(), 'hancut-frames-'));
try {
  if (!only) await rm(OUT, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  await mkdir(join(OUT, 'thumb'), { recursive: true });
  await mkdir(join(OUT, 'fonts'), { recursive: true });
  const assets = {
    ...(await festivalAssets(tmp)),
    ice: url(join(ROOT, 'public', 'brand', 'ice-logo.webp')),
    himchan: url(join(ROOT, 'public', '과학힘찬이.png')),
  };
  const list = FRAMES.filter((f) => !only || only.includes(f.id));
  const overlays = [];
  for (const f of list) {
    overlays.push(await buildFrame(f, assets, tmp));
    console.log('frame', f.id);
  }
  if (!only) buildDateFonts(tmp);
  if (process.argv.includes('--sheet')) await contactSheet(overlays);
  console.log('frames ok');
} finally {
  await rm(tmp, { recursive: true, force: true });
}

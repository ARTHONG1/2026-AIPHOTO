#!/usr/bin/env node
// Builds optimized preset assets for the photobooth.
//   node scripts/build-assets.mjs            -> writes public/presets/** and public/brand/**
//   node scripts/build-assets.mjs --sheet    -> also writes a pose contact sheet to $TEMP
//   node scripts/build-assets.mjs --cards [--sheet] -> rebuilds only the pose and composition sketch cards
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { POSE_GEOMETRY } from './pose-geometry.mjs';
import { COMPOSITION_GEOMETRY } from './composition-geometry.mjs';
import { renderCompositionSketch, renderPoseSketch } from './sketch.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUB = join(ROOT, 'public');
const OUT = join(PUB, 'presets');
// AI-generated source images (assets-src/<kind>/<preset-id>.png).
const SRC = join(ROOT, 'assets-src');

async function sourceIds(kind) {
  const files = await readdir(join(SRC, kind)).catch(() => []);
  return files.filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4));
}

// Existing hand-made assets and the ids they map to.
const LEGACY_BACKGROUNDS = {
  'space-galaxy': { src: 'backgrounds/우주.png', watermark: true },
  'future-lab': { src: 'backgrounds/실험실.png', watermark: true },
  'dino-dig': { src: 'backgrounds/고고학.png', watermark: true },
  'river-valley': { src: 'backgrounds/강.png' },
  'sunset-beach': { src: 'backgrounds/바다.png', watermark: true },
};
// Every pose is drawn from scripts/pose-geometry.mjs so all thumbnails share one style.
const LEGACY_PROPS = {
  'ai-glasses': 'props/안경.png',
  'science-tee': 'props/티셔츠.png',
  'einstein-wig': 'props/아인슈타인가발.png',
  'cyber-helmet': 'props/마스크.png',
};
const BRAND = {
  himchan: '힘찬이.png',
  'himchan-science': '과학힘찬이.png',
};

// ---------- pose renderer ----------
// Two themes from the same geometry: 'ui' is the colored mannequin shown on cards,
// 'ref' is a plain black-on-white guide sent to the image model (limb directions only).
const THEMES = {
  ui: { ink: '#2b2350', body: '#ffffff', shirt: '#ffd84d', skin: '#ffe9d6', bg: null, accent: '#5de4ff' },
  ref: { ink: '#222222', body: '#ffffff', shirt: '#ffffff', skin: '#ffffff', bg: '#ffffff', accent: '#222222' },
};
let T = THEMES.ui;
const rad = (d) => (d * Math.PI) / 180;
const add = (p, v) => ({ x: p.x + v.x, y: p.y + v.y });
const rot = (v, deg) => {
  const a = rad(deg);
  return { x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) };
};
// side: -1 = viewer's left, +1 = viewer's right
const dir = (side, deg, len) => ({ x: side * Math.sin(rad(deg)) * len, y: Math.cos(rad(deg)) * len });
const f = (n) => Math.round(n * 10) / 10;
const pts = (list) => list.map((p) => f(p.x) + ',' + f(p.y)).join(' ');

function tube(points, width, outline = 5, fill = T.body) {
  const d = 'M' + points.map((p) => f(p.x) + ' ' + f(p.y)).join(' L');
  return (
    '<path d="' + d + '" fill="none" stroke="' + T.ink + '" stroke-width="' + (width + outline * 2) + '" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="' + d + '" fill="none" stroke="' + fill + '" stroke-width="' + width + '" stroke-linecap="round" stroke-linejoin="round"/>'
  );
}

function hand(pos, kind, pointing, scale = 1) {
  // pointing: absolute screen angle (deg, 0 = down, 90 = right, 180 = up)
  const fingerDir = (deg, len) => ({ x: Math.sin(rad(deg)) * len * scale, y: Math.cos(rad(deg)) * len * scale });
  let out = '';
  const finger = (deg, len = 20) => {
    const a = add(pos, fingerDir(deg, 10));
    const b = add(pos, fingerDir(deg, 10 + len));
    out += tube([a, b], 9 * scale, 4, T.skin);
  };
  if (kind === 'none') return '';
  if (kind === 'open') [-36, -12, 12, 36].forEach((o) => finger(pointing + o, 17));
  if (kind === 'v') [-14, 14].forEach((o) => finger(pointing + o, 24));
  if (kind === 'point') finger(pointing, 26);
  if (kind === 'thumb') finger(180, 20);
  if (kind === 'ring') {
    return '<circle cx="' + f(pos.x) + '" cy="' + f(pos.y) + '" r="22" fill="none" stroke="' + T.ink + '" stroke-width="13"/>' +
      '<circle cx="' + f(pos.x) + '" cy="' + f(pos.y) + '" r="22" fill="none" stroke="' + T.skin + '" stroke-width="5"/>';
  }
  if (kind === 'heart') {
    // Both hands meet in one heart shape in front of the chest.
    const x = pos.x + 12;
    const y = pos.y - 4;
    return '<path d="M' + x + ' ' + (y + 34) + ' C' + (x - 52) + ' ' + (y + 2) + ' ' + (x - 30) + ' ' + (y - 34) + ' ' + x + ' ' + (y - 12) +
      ' C' + (x + 30) + ' ' + (y - 34) + ' ' + (x + 52) + ' ' + (y + 2) + ' ' + x + ' ' + (y + 34) + ' Z" fill="' + (T.bg ? '#fff' : '#ff7ad9') + '" stroke="' + T.ink + '" stroke-width="6" stroke-linejoin="round"/>';
  }
  if (kind === 'camera') {
    const x = pos.x + 34;
    const y = pos.y;
    return '<rect x="' + (x - 44) + '" y="' + (y - 26) + '" width="88" height="56" rx="12" fill="' + (T.bg ? '#fff' : '#5de4ff') + '" stroke="' + T.ink + '" stroke-width="6"/>' +
      '<circle cx="' + x + '" cy="' + (y + 2) + '" r="15" fill="#fff" stroke="' + T.ink + '" stroke-width="6"/>' +
      '<rect x="' + (x + 16) + '" y="' + (y - 36) + '" width="20" height="12" rx="3" fill="' + T.ink + '"/>';
  }
  if (kind === 'ball') {
    out += '<circle cx="' + f(pos.x) + '" cy="' + f(pos.y - 30) + '" r="22" fill="' + (T.bg ? '#fff' : '#ff9b4d') + '" stroke="' + T.ink + '" stroke-width="5"/>';
    out += '<path d="M' + f(pos.x - 22) + ' ' + f(pos.y - 30) + ' Q' + f(pos.x) + ' ' + f(pos.y - 16) + ' ' + f(pos.x + 22) + ' ' + f(pos.y - 30) + '" fill="none" stroke="' + T.ink + '" stroke-width="4"/>';
  }
  out += '<circle cx="' + f(pos.x) + '" cy="' + f(pos.y) + '" r="' + f(17 * scale) + '" fill="' + T.skin + '" stroke="' + T.ink + '" stroke-width="5"/>';
  return out;
}

// Two-bone IK: returns [start, elbow, end] reaching toward target.
function ikLimb(start, target, l1, l2, side, bend = 'out') {
  const dx = target.x - start.x;
  const dy = target.y - start.y;
  const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(l1 - l2) + 1), l1 + l2 - 1);
  const base = Math.atan2(dy, dx);
  const a = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d));
  const cands = [base + a, base - a].map((ang) => ({ x: start.x + Math.cos(ang) * l1, y: start.y + Math.sin(ang) * l1 }));
  const score = (e) => (bend === 'down' ? e.y : side * e.x);
  const elbow = score(cands[0]) >= score(cands[1]) ? cands[0] : cands[1];
  const ang = Math.atan2(target.y - elbow.y, target.x - elbow.x);
  return [start, elbow, { x: elbow.x + Math.cos(ang) * l2, y: elbow.y + Math.sin(ang) * l2 }];
}

function renderPose(g, theme = 'ui') {
  T = THEMES[theme];
  const lean = g.lean ?? 0;
  const dy = g.dy ?? 0;
  const pelvis = { x: 256, y: 318 + dy };
  // A bow tilts only the upper body forward (toward the viewer it reads as a lower head).
  const bowTilt = g.bow ? 1 : 0;
  const up = (v) => rot(v, lean);
  const neck = add(pelvis, up({ x: 0, y: bowTilt ? -96 : -122 }));
  const head = add(neck, up({ x: 0, y: bowTilt ? -38 : -70 }));
  const shoulder = (s) => add(neck, up({ x: s * 46, y: 14 }));
  const hip = (s) => add(pelvis, up({ x: s * 27, y: 0 }));
  const limb = (start, side, [a1, a2], l1, l2) => {
    const mid = add(start, dir(side, a1, l1));
    const end = add(mid, dir(side, a2, l2));
    return [start, mid, end];
  };
  const arm = (side, key) => {
    const target = g[key + 't'];
    if (target) return ikLimb(shoulder(side), target, 68, 60, side, g[key + 'b'] ?? 'out');
    return limb(shoulder(side), side, g[key + 'a'] ?? [12, 6], 68, 60);
  };
  const L = arm(-1, 'l');
  const R = arm(1, 'r');
  const LL = limb(hip(-1), -1, g.ll ?? [4, 0], 74, 72);
  const RL = limb(hip(1), 1, g.rl ?? [4, 0], 74, 72);
  const segAngle = (a, b) => (Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI;

  let svg = '';
  if (!T.bg) {
    // Soft floor shadow grounds the figure on the card.
    svg += '<ellipse cx="256" cy="' + (482 + Math.max(0, dy) * 0.2) + '" rx="' + (dy < -10 ? 70 : 96) + '" ry="12" fill="#2b2350" opacity="' + (dy < -10 ? 0.1 : 0.16) + '"/>';
  }
  // legs + feet
  for (const [leg, side] of [[LL, -1], [RL, 1]]) {
    svg += tube(leg, 34, 5, T.body);
    const foot = add(leg[2], { x: side * 12, y: 6 });
    svg += '<ellipse cx="' + f(foot.x) + '" cy="' + f(foot.y) + '" rx="26" ry="13" fill="' + T.body + '" stroke="' + T.ink + '" stroke-width="5"/>';
  }
  // torso (shirt)
  const tl = add(neck, up({ x: -52, y: 6 }));
  const tr = add(neck, up({ x: 52, y: 6 }));
  const br = add(pelvis, up({ x: 44, y: 16 }));
  const bl = add(pelvis, up({ x: -44, y: 16 }));
  svg += '<path d="M' + f(tl.x) + ' ' + f(tl.y) + ' Q' + f(neck.x) + ' ' + f(neck.y - 8) + ' ' + f(tr.x) + ' ' + f(tr.y) +
    ' L' + f(br.x) + ' ' + f(br.y) + ' Q' + f(pelvis.x) + ' ' + f(pelvis.y + 24) + ' ' + f(bl.x) + ' ' + f(bl.y) + ' Z" fill="' + T.shirt + '" stroke="' + T.ink + '" stroke-width="5" stroke-linejoin="round"/>';
  // head before arms so hands near the face stay visible
  svg += '<circle cx="' + f(head.x) + '" cy="' + f(head.y) + '" r="' + (bowTilt ? 62 : 70) + '" fill="' + T.skin + '" stroke="' + T.ink + '" stroke-width="5"/>';
  for (const [arm, key] of [[L, 'l'], [R, 'r']]) {
    svg += tube(arm, 28, 5, T.skin);
    const pointing = g[key + 'hDir'] ?? segAngle(arm[1], arm[2]);
    svg += hand(arm[2], g[key + 'h'] ?? 'fist', pointing, g[key + 'hScale'] ?? 1);
  }
  for (const extra of g.extras ?? []) {
    if (extra === 'motion') {
      for (const x of [206, 256, 306]) svg += '<path d="M' + x + ' ' + (478 + dy / 3) + ' l0 22" stroke="' + T.accent + '" stroke-width="6" stroke-linecap="round"/>';
    }
    if (extra === 'speed') {
      for (const [y, len] of [[200, 56], [250, 80], [300, 48]]) svg += '<path d="M' + (120 - len) + ' ' + y + ' l' + len + ' 0" stroke="' + T.accent + '" stroke-width="6" stroke-linecap="round"/>';
    }
    if (extra === 'wave') {
      for (const r of [34, 54]) svg += '<path d="M' + (392 + r * 0.2) + ' ' + (60 - r * 0.4) + ' a' + r + ' ' + r + ' 0 0 1 ' + r * 0.6 + ' ' + r * 1.1 + '" fill="none" stroke="' + T.accent + '" stroke-width="6" stroke-linecap="round"/>';
    }
    if (extra === 'think') {
      svg += '<circle cx="360" cy="70" r="26" fill="' + (T.bg ? '#fff' : '#ffffff') + '" stroke="' + T.ink + '" stroke-width="5"/>' +
        '<circle cx="334" cy="112" r="10" fill="#fff" stroke="' + T.ink + '" stroke-width="5"/>' +
        '<text x="360" y="82" font-size="34" font-family="Arial" font-weight="700" text-anchor="middle" fill="' + T.ink + '">?</text>';
    }
    if (extra === 'zap') {
      const bolt = (x, y, s) => '<path d="M' + x + ' ' + y + ' l' + 14 * s + ' 16 l' + -10 * s + ' 4 l' + 16 * s + ' 20" fill="none" stroke="' + (T.bg ? T.ink : '#ffd84d') + '" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>';
      svg += bolt(70, 150, 1) + bolt(442, 150, -1) + bolt(90, 330, 1) + bolt(422, 330, -1);
    }
  }
  const bg = T.bg ? '<rect width="512" height="512" fill="' + T.bg + '"/>' : '';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">' + bg + svg + '</svg>';
}

// ---------- helpers ----------
async function ensure(dir) {
  await mkdir(dir, { recursive: true });
}

async function trimmed(src, watermark) {
  const img = sharp(join(PUB, src));
  const { width, height } = await img.metadata();
  if (!watermark) return sharp(join(PUB, src));
  // Drop the bottom-right generator badge before cropping.
  const w = Math.round(width * 0.95);
  const h = Math.round(height * 0.95);
  return sharp(await img.extract({ left: 0, top: 0, width: w, height: h }).toBuffer());
}


// Reference images for the model are WebP (Gemini does not take AVIF); cards shown only in the
// browser are AVIF, about 30% smaller than WebP at the same measured quality (PSNR).
// effort 6 is slow to encode but gives the smallest files.
const WEBP = (quality) => ({ quality, effort: 6, smartSubsample: true });
const AVIF = (quality) => ({ quality, effort: 6 });
const bgThumb = (img) => img.resize(480, 600, { fit: 'cover', position: 'attention' }).avif(AVIF(52));
const bgRef = (img) => img.resize(768, 1152, { fit: 'cover', position: 'centre' }).webp(WEBP(80));

async function buildBackgrounds() {
  const dir = join(OUT, 'backgrounds');
  await ensure(join(dir, 'ref'));
  for (const [id, { src, watermark }] of Object.entries(LEGACY_BACKGROUNDS)) {
    const base = await (await trimmed(src, watermark)).toBuffer();
    await bgThumb(sharp(base)).toFile(join(dir, id + '.avif'));
    await bgRef(sharp(base)).toFile(join(dir, 'ref', id + '.webp'));
  }
  for (const id of await sourceIds('backgrounds')) {
    const file = join(SRC, 'backgrounds', id + '.png');
    await bgThumb(sharp(file)).toFile(join(dir, id + '.avif'));
    await bgRef(sharp(file)).toFile(join(dir, 'ref', id + '.webp'));
  }
}

async function contactSheet(tiles, name, cols, size) {
  const rows = Math.ceil(tiles.length / cols);
  const composites = await Promise.all(
    tiles.map(async (t, i) => ({ input: await sharp(t.buf).resize(size, size).toBuffer(), left: (i % cols) * size, top: Math.floor(i / cols) * size }))
  );
  const out = join(tmpdir(), name);
  await sharp({ create: { width: cols * size, height: rows * size, channels: 3, background: '#dddddd' } }).composite(composites).png().toFile(out);
  console.log('sheet:', out);
}

// Cards are pencil sketches (scripts/sketch.mjs); the model gets the plain black-on-white guide.
async function buildPoses(sheet) {
  const dir = join(OUT, 'poses');
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  await ensure(join(dir, 'ref'));
  const tiles = [];
  let seed = 1;
  for (const [id, geo] of Object.entries(POSE_GEOMETRY)) {
    const card = renderPoseSketch(geo, seed++);
    await writeFile(join(dir, id + '.svg'), card);
    const ref = await sharp(Buffer.from(renderPose(geo, 'ref'))).png({ palette: true }).toBuffer();
    await writeFile(join(dir, 'ref', id + '.png'), ref);
    if (sheet) tiles.push({ id, buf: await sharp(Buffer.from(card)).png().toBuffer() });
  }
  if (sheet) await contactSheet(tiles, 'pose-sheet.png', 10, 160);
}

async function buildProps() {
  const dir = join(OUT, 'props');
  await ensure(join(dir, 'ref'));
  const write = async (base) => {
    const thumb = sharp(base).resize(320, 320, { fit: 'contain', background: '#ffffff' }).flatten({ background: '#ffffff' }).avif(AVIF(58));
    const ref = sharp(base).resize(640, 640, { fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).webp(WEBP(84));
    return [thumb, ref];
  };
  for (const [id, src] of Object.entries(LEGACY_PROPS)) {
    const base = await sharp(join(PUB, src)).flatten({ background: '#ffffff' }).trim({ threshold: 4 }).toBuffer();
    const [thumb, ref] = await write(base);
    await thumb.toFile(join(dir, id + '.avif'));
    await ref.toFile(join(dir, 'ref', id + '.webp'));
  }
  for (const id of await sourceIds('props')) {
    // Generated props sit on plain white; flatten any alpha to the same white.
    const base = await sharp(join(SRC, 'props', id + '.png')).flatten({ background: '#ffffff' }).trim({ threshold: 12 }).toBuffer();
    const [thumb, ref] = await write(base);
    await thumb.toFile(join(dir, id + '.avif'));
    await ref.toFile(join(dir, 'ref', id + '.webp'));
  }
}

async function buildBrand() {
  const dir = join(PUB, 'brand');
  await ensure(dir);
  for (const [id, src] of Object.entries(BRAND)) {
    await sharp(join(PUB, src)).resize({ height: 480, withoutEnlargement: true }).webp({ quality: 85, alphaQuality: 90 }).toFile(join(dir, id + '.webp'));
  }
  // Office of Education logo for the lobby footer.
  await sharp(join(PUB, '교육청.png')).trim({ threshold: 10 }).resize({ height: 96 }).webp({ quality: 88 }).toFile(join(dir, 'ice-logo.webp'));
}

async function buildCompositions(sheet) {
  const dir = join(OUT, 'compositions');
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  await ensure(dir);
  const tiles = [];
  let seed = 7;
  for (const [id, geo] of Object.entries(COMPOSITION_GEOMETRY)) {
    const card = renderCompositionSketch(geo, seed++);
    await writeFile(join(dir, id + '.svg'), card);
    if (sheet) tiles.push({ id, buf: await sharp(Buffer.from(card)).png().toBuffer() });
  }
  if (sheet) await contactSheet(tiles, 'composition-sheet.png', 10, 160);
}

const sheet = process.argv.includes('--sheet');
if (process.argv.includes('--cards')) {
  // Only the sketch cards (poses + compositions); photos are left untouched.
  await buildPoses(sheet);
  await buildCompositions(sheet);
  console.log('cards ok');
  process.exit(0);
}
// Output folders are fully generated; clear them so renamed ids do not linger.
// Retries cover files briefly locked by the dev server's watcher on Windows.
const RM = { recursive: true, force: true, maxRetries: 10, retryDelay: 300 };
await rm(OUT, RM);
await rm(join(PUB, 'brand'), RM);
await buildBackgrounds();
await buildPoses(sheet);
await buildProps();
await buildBrand();
await buildCompositions(sheet);
console.log('assets ok');

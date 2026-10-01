// Measures a frame PNG: photo slots (transparent or flat placeholder areas) and edge colors.
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('../../node_modules/sharp');
const file = process.argv[2];
const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const px = (x, y) => { const i = (y * W + x) * 4; return [data[i], data[i + 1], data[i + 2], data[i + 3]]; };
let transparent = 0, semi = 0;
for (let i = 3; i < data.length; i += 4) { if (data[i] < 10) transparent++; else if (data[i] < 245) semi++; }
console.log('size', W, H, 'transparent', transparent, 'semi', semi);
console.log('samples', JSON.stringify({ corner: px(2, 2), slot1: px(300, 200), gap: px(300, 405), bottom: px(300, 1700), border: px(10, 900) }));
// Slot rows: rows where the middle column matches the slot sample color (or is transparent).
const ref = px(300, 200);
const isSlot = (p) => (ref[3] < 10 ? p[3] < 10 : Math.abs(p[0] - ref[0]) + Math.abs(p[1] - ref[1]) + Math.abs(p[2] - ref[2]) < 12 && p[3] > 245);
const slots = [];
let start = -1;
for (let y = 0; y < H; y++) {
  const on = isSlot(px(300, y));
  if (on && start < 0) start = y;
  if (!on && start >= 0) { slots.push([start, y - 1]); start = -1; }
}
if (start >= 0) slots.push([start, H - 1]);
for (const [a, b] of slots) {
  const y = Math.round((a + b) / 2);
  let l = -1, r = -1;
  for (let x = 0; x < W; x++) if (isSlot(px(x, y))) { if (l < 0) l = x; r = x; }
  console.log('slot', JSON.stringify({ top: a, bottom: b, height: b - a + 1, left: l, right: r, width: r - l + 1 }));
}

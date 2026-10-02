'use client';

// Lens effects the image model does not render strongly enough, finished in the browser right
// after generation (before the frame, print and QR steps, so every output gets them).
// Bokeh and panning need the person separated from the scene: MediaPipe's selfie segmenter
// (the same 0.25 MB model as the AR camera) cuts the person out, the hole is filled from the
// surrounding scene, and only the scene is blurred.
import type { ImageSegmenter } from '@mediapipe/tasks-vision';

const TASKS_VERSION = '1.0.1';
const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + TASKS_VERSION + '/wasm';
const SEGMENT_MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

type Effect = (img: HTMLImageElement) => Promise<HTMLCanvasElement>;

const EFFECTS: Record<string, Effect> = {
  bokeh: (img) => withPerson(img, (bg, person, full) => bokeh(bg, person, full)),
  panning: (img) => withPerson(img, (bg, person) => panning(bg, person)),
  'tilt-shift': (img) => withPerson(img, (bg, person, full) => tiltShift(full, person)),
  'soft-focus': async (img) => softFocus(toCanvas(img)),
};

export const hasLensEffect = (compositionId?: string | null) => Boolean(compositionId && EFFECTS[compositionId]);

/** Starts downloading the cut-out model early (during the AI generation wait). */
export function preloadLensEffect(compositionId?: string | null) {
  if (compositionId && compositionId !== 'soft-focus' && EFFECTS[compositionId]) segmenter().catch(() => undefined);
}

/** Returns the image with the composition's lens effect, or the original on any failure. */
export async function applyLensEffect(image: string, compositionId?: string | null): Promise<string> {
  const effect = compositionId ? EFFECTS[compositionId] : undefined;
  if (!effect) return image;
  try {
    const img = await loadImage(image);
    const out = await effect(img);
    return out.toDataURL('image/png');
  } catch (error) {
    console.warn('[lens effect] skipped', error);
    return image;
  }
}

// ---------- helpers ----------
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function ctx2d(c: HTMLCanvasElement) {
  return c.getContext('2d', { willReadFrequently: false })!;
}

function toCanvas(img: CanvasImageSource & { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number }) {
  const w = (img as HTMLImageElement).naturalWidth || (img as HTMLCanvasElement).width;
  const h = (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height;
  const c = canvas(w, h);
  ctx2d(c).drawImage(img, 0, 0, w, h);
  return c;
}

const smooth = (lo: number, hi: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};

let filterSupport: boolean | null = null;
function canFilter() {
  if (filterSupport === null) {
    const c = canvas(2, 2).getContext('2d')!;
    filterSupport = typeof c.filter === 'string';
  }
  return filterSupport;
}

/** Gaussian-looking blur; pads the edges so the borders do not darken. */
function blur(src: HTMLCanvasElement, radius: number): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const pad = Math.ceil(radius * 2.5);
  const padded = canvas(w + pad * 2, h + pad * 2);
  const pc = ctx2d(padded);
  pc.drawImage(src, 0, 0, w + pad * 2, h + pad * 2);
  pc.drawImage(src, pad, pad);
  const out = canvas(w + pad * 2, h + pad * 2);
  const oc = ctx2d(out);
  if (canFilter()) {
    oc.filter = 'blur(' + radius + 'px)';
    oc.drawImage(padded, 0, 0);
    oc.filter = 'none';
  } else {
    // No canvas filter (older Safari): blur by shrinking and growing back in halves.
    let cur: HTMLCanvasElement = padded;
    const steps: HTMLCanvasElement[] = [];
    while (cur.width > (w + pad * 2) / (radius / 1.5) && cur.width > 8) {
      const next = canvas(Math.max(1, Math.round(cur.width / 2)), Math.max(1, Math.round(cur.height / 2)));
      const nc = ctx2d(next);
      nc.imageSmoothingQuality = 'high';
      nc.drawImage(cur, 0, 0, next.width, next.height);
      steps.push(next);
      cur = next;
    }
    for (let i = steps.length - 2; i >= -1; i--) {
      const target = i >= 0 ? steps[i] : out;
      const tc = ctx2d(target);
      tc.imageSmoothingQuality = 'high';
      tc.clearRect(0, 0, target.width, target.height);
      tc.drawImage(cur, 0, 0, target.width, target.height);
      cur = target;
    }
    if (cur !== out) oc.drawImage(cur, 0, 0, out.width, out.height);
  }
  const crop = canvas(w, h);
  ctx2d(crop).drawImage(out, pad, pad, w, h, 0, 0, w, h);
  return crop;
}

// ---------- person cut-out ----------
let segmenterPromise: Promise<ImageSegmenter> | null = null;
function segmenter(): Promise<ImageSegmenter> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');
      const files = await FilesetResolver.forVisionTasks(WASM_BASE);
      const make = (delegate: 'GPU' | 'CPU') =>
        ImageSegmenter.createFromOptions(files, {
          baseOptions: { modelAssetPath: SEGMENT_MODEL, delegate },
          runningMode: 'IMAGE',
          outputConfidenceMasks: true,
          outputCategoryMask: false,
        });
      return make('GPU').catch(() => make('CPU'));
    })();
    segmenterPromise.catch(() => (segmenterPromise = null));
  }
  return segmenterPromise;
}

type Masks = { person: HTMLCanvasElement; hole: HTMLCanvasElement; box: { top: number; bottom: number; cy: number } };

/** Person masks at full size: a crisp one for the cut-out, a wider one for the hole to fill. */
async function personMasks(img: HTMLImageElement, w: number, h: number): Promise<Masks> {
  const seg = await segmenter();
  const res = seg.segment(img);
  const m = res.confidenceMasks?.[0];
  if (!m) {
    res.close();
    throw new Error('no mask');
  }
  const mw = m.width;
  const mh = m.height;
  const conf = m.getAsFloat32Array().slice();
  res.close();

  // Widen the hole mask a little (max filter) so no edge of the person is smeared into the blur.
  let wide = conf;
  for (let pass = 0; pass < Math.max(2, Math.round(mw / 90)); pass++) {
    const next = new Float32Array(wide.length);
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        let v = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = Math.min(mh - 1, Math.max(0, y + dy));
          for (let dx = -1; dx <= 1; dx++) {
            const xx = Math.min(mw - 1, Math.max(0, x + dx));
            v = Math.max(v, wide[yy * mw + xx]);
          }
        }
        next[y * mw + x] = v;
      }
    }
    wide = next;
  }

  const small = (data: Float32Array, lo: number, hi: number) => {
    const c = canvas(mw, mh);
    const id = new ImageData(mw, mh);
    for (let i = 0; i < data.length; i++) {
      id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = 255;
      id.data[i * 4 + 3] = smooth(lo, hi, data[i]) * 255;
    }
    ctx2d(c).putImageData(id, 0, 0);
    return c;
  };
  const up = (c: HTMLCanvasElement, sharpen: boolean) => {
    const out = canvas(w, h);
    const oc = out.getContext('2d', { willReadFrequently: sharpen })!;
    oc.imageSmoothingQuality = 'high';
    oc.drawImage(c, 0, 0, w, h);
    if (sharpen) {
      // Upscaling softens the edge over several pixels; tighten it again at full size.
      const id = oc.getImageData(0, 0, w, h);
      for (let i = 3; i < id.data.length; i += 4) id.data[i] = smooth(0.35, 0.65, id.data[i] / 255) * 255;
      oc.putImageData(id, 0, 0);
    }
    return out;
  };

  let top = mh;
  let bottom = 0;
  let sum = 0;
  let sumY = 0;
  for (let y = 0; y < mh; y++) {
    for (let x = 0; x < mw; x++) {
      const v = conf[y * mw + x];
      if (v > 0.5) {
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
        sum += v;
        sumY += v * y;
      }
    }
  }
  if (!sum) throw new Error('no person found');
  return {
    person: up(small(conf, 0.3, 0.7), true),
    hole: up(small(wide, 0.05, 0.3), false),
    box: { top: (top / mh) * h, bottom: ((bottom + 1) / mh) * h, cy: (sumY / sum / mh) * h },
  };
}

/** The scene with the person removed and the hole filled from the surroundings. */
function sceneOnly(full: HTMLCanvasElement, hole: HTMLCanvasElement) {
  const w = full.width;
  const h = full.height;
  const cut = canvas(w, h);
  const cc = ctx2d(cut);
  cc.drawImage(full, 0, 0);
  cc.globalCompositeOperation = 'destination-out';
  cc.drawImage(hole, 0, 0);
  cc.globalCompositeOperation = 'source-over';
  // Pyramid fill: each smaller copy averages the visible scene over a wider area (premultiplied
  // alpha keeps the hole from turning dark); stacking them from coarse to fine fills the hole.
  const levels: HTMLCanvasElement[] = [];
  let cur = cut;
  while (cur.width > 12) {
    const next = canvas(Math.max(1, Math.round(cur.width / 2)), Math.max(1, Math.round(cur.height / 2)));
    const nc = ctx2d(next);
    nc.imageSmoothingQuality = 'high';
    nc.drawImage(cur, 0, 0, next.width, next.height);
    levels.push(next);
    cur = next;
  }
  const out = canvas(w, h);
  const oc = ctx2d(out);
  oc.imageSmoothingQuality = 'high';
  // A heavily blurred copy of the whole photo is the base, so a hole that touches the edge
  // (feet at the bottom) never stays transparent.
  oc.drawImage(blur(full, Math.round(w / 12)), 0, 0);
  for (let i = levels.length - 1; i >= 0; i--) {
    // Each level is drawn several times so partly covered pixels become opaque.
    for (let k = 0; k < 3; k++) oc.drawImage(levels[i], 0, 0, w, h);
  }
  oc.drawImage(cut, 0, 0);
  return out;
}

async function withPerson(
  img: HTMLImageElement,
  finish: (scene: HTMLCanvasElement, person: { layer: HTMLCanvasElement; masks: Masks }, full: HTMLCanvasElement) => HTMLCanvasElement
) {
  const full = toCanvas(img);
  const masks = await personMasks(img, full.width, full.height);
  const layer = canvas(full.width, full.height);
  const lc = ctx2d(layer);
  lc.drawImage(full, 0, 0);
  lc.globalCompositeOperation = 'destination-in';
  lc.drawImage(masks.person, 0, 0);
  return finish(sceneOnly(full, masks.hole), { layer, masks }, full);
}

// ---------- effects ----------
/**
 * The sharp zone of a shallow depth of field: the person mask plus a soft oval around the body,
 * so hands, held items and things floating right next to the person stay in focus too.
 */
function focusLayer(full: HTMLCanvasElement, masks: Masks) {
  const w = full.width;
  const h = full.height;
  const zone = canvas(w, h);
  const zc = ctx2d(zone);
  const { top, bottom } = masks.box;
  const cy = top + (bottom - top) * 0.45;
  const ry = (bottom - top) * 0.62;
  const rx = Math.min(w * 0.48, ry * 0.75);
  zc.save();
  zc.translate(w / 2, cy);
  zc.scale(rx / ry, 1);
  const g = zc.createRadialGradient(0, 0, ry * 0.55, 0, 0, ry);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  zc.fillStyle = g;
  zc.fillRect(-ry * 2, -ry * 2, ry * 4, ry * 4);
  zc.restore();
  zc.drawImage(masks.person, 0, 0);
  const layer = canvas(w, h);
  const lc = ctx2d(layer);
  lc.drawImage(full, 0, 0);
  lc.globalCompositeOperation = 'destination-in';
  lc.drawImage(zone, 0, 0);
  return layer;
}

/** f/1.4 look: creamy background blur with round highlight discs, the person stays sharp. */
function bokeh(scene: HTMLCanvasElement, person: { layer: HTMLCanvasElement; masks: Masks }, full: HTMLCanvasElement) {
  const w = scene.width;
  const h = scene.height;
  const out = blur(scene, Math.round(w / 45));
  const oc = ctx2d(out);

  // Highlights of the scene become bokeh balls: brightest cells of a coarse grid.
  const gw = 36;
  const gh = Math.round((gw * h) / w);
  const grid = canvas(gw, gh);
  const gc = grid.getContext('2d', { willReadFrequently: true })!;
  gc.imageSmoothingQuality = 'high';
  gc.drawImage(scene, 0, 0, gw, gh);
  const px = gc.getImageData(0, 0, gw, gh).data;
  const cells: { x: number; y: number; l: number; c: [number, number, number] }[] = [];
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const i = (y * gw + x) * 4;
      const l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
      cells.push({ x, y, l, c: [px[i], px[i + 1], px[i + 2]] });
    }
  }
  cells.sort((a, b) => b.l - a.l);
  const cut = Math.max(120, cells[Math.floor(cells.length * 0.08)].l);
  const picked: typeof cells = [];
  for (const cell of cells) {
    if (cell.l < cut || picked.length >= 34) break;
    if (picked.some((p) => Math.abs(p.x - cell.x) + Math.abs(p.y - cell.y) < 3)) continue;
    picked.push(cell);
  }
  const r0 = w / 24;
  oc.save();
  oc.globalCompositeOperation = 'screen';
  picked.forEach((p, i) => {
    const r = r0 * (0.65 + ((i * 37) % 10) / 14);
    const cx = ((p.x + 0.5) / gw) * w + (((i * 53) % 7) - 3) * (w / gw / 6);
    const cy = ((p.y + 0.5) / gh) * h + (((i * 29) % 7) - 3) * (h / gh / 6);
    const [cr, cg, cb] = p.c.map((v) => Math.min(255, Math.round(v * 0.75 + 70)));
    const g = oc.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
    g.addColorStop(0, 'rgba(' + cr + ',' + cg + ',' + cb + ',0.22)');
    g.addColorStop(0.82, 'rgba(' + cr + ',' + cg + ',' + cb + ',0.32)');
    g.addColorStop(0.94, 'rgba(' + cr + ',' + cg + ',' + cb + ',0.5)');
    g.addColorStop(1, 'rgba(' + cr + ',' + cg + ',' + cb + ',0)');
    oc.fillStyle = g;
    oc.beginPath();
    oc.arc(cx, cy, r, 0, Math.PI * 2);
    oc.fill();
  });
  oc.restore();
  oc.drawImage(focusLayer(full, person.masks), 0, 0);
  return out;
}

/** Camera follows the subject: the scene streaks sideways, the person stays sharp. */
function panning(scene: HTMLCanvasElement, person: { layer: HTMLCanvasElement }) {
  const w = scene.width;
  const h = scene.height;
  const out = canvas(w, h);
  const oc = ctx2d(out);
  const len = w * 0.09;
  const n = 28;
  // Running average of shifted copies = horizontal box blur.
  for (let i = 0; i < n; i++) {
    oc.globalAlpha = 1 / (i + 1);
    const dx = -len / 2 + (len * i) / (n - 1);
    oc.drawImage(scene, dx - len, 0, w + len * 2, h);
    oc.drawImage(scene, dx, 0);
  }
  oc.globalAlpha = 1;
  oc.drawImage(person.layer, 0, 0);
  return out;
}

/** Miniature look: only a band around the person is sharp, colors pop. */
function tiltShift(full: HTMLCanvasElement, person: { masks: Masks }) {
  const w = full.width;
  const h = full.height;
  const pop = canvas(w, h);
  const pc = ctx2d(pop);
  if (canFilter()) pc.filter = 'saturate(1.45) contrast(1.12)';
  pc.drawImage(full, 0, 0);
  pc.filter = 'none';
  const out = blur(pop, Math.round(w / 55));
  const { top, bottom, cy } = person.masks.box;
  const half = Math.max(h * 0.1, (bottom - top) * 0.32);
  const sharp = canvas(w, h);
  const sc = ctx2d(sharp);
  sc.drawImage(pop, 0, 0);
  sc.globalCompositeOperation = 'destination-in';
  const g = sc.createLinearGradient(0, cy - half * 2.2, 0, cy + half * 2.2);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.3, 'rgba(0,0,0,1)');
  g.addColorStop(0.7, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  sc.fillStyle = g;
  sc.fillRect(0, 0, w, h);
  ctx2d(out).drawImage(sharp, 0, 0);
  return out;
}

/** Diffusion filter (Orton effect): a glowing blurred copy screened over the photo. */
function softFocus(full: HTMLCanvasElement) {
  const w = full.width;
  const out = canvas(full.width, full.height);
  const oc = ctx2d(out);
  oc.drawImage(full, 0, 0);
  const glow = blur(full, Math.round(w / 45));
  oc.globalCompositeOperation = 'screen';
  oc.globalAlpha = 0.62;
  oc.drawImage(glow, 0, 0);
  oc.globalCompositeOperation = 'soft-light';
  oc.globalAlpha = 0.45;
  oc.drawImage(glow, 0, 0);
  // A wide halo around the brightest parts, like a diffusion filter on the lens.
  const halo = blur(full, Math.round(w / 14));
  oc.globalCompositeOperation = 'lighter';
  oc.globalAlpha = 0.18;
  oc.drawImage(halo, 0, 0);
  return out;
}

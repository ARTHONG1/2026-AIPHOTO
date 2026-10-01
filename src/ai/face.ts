/**
 * Face identity for the booth composite. Runs locally (OpenCV YuNet through opencv-js), so it
 * adds about a second and no extra API call.
 *
 * The image model redraws the whole frame, so even with a close-up reference the face drifts:
 * on test composites the face similarity to the visitor (OpenCV SFace) was only 0.49-0.71.
 * After compositing, transferFace aligns the visitor's real face to the drawn one with five
 * landmarks, matches its color and light to the scene and blends only the inner face back
 * (0.79-0.85). Hair, headwear, pose and background stay as the model drew them.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

type Pt = { x: number; y: number };
type Box = { left: number; top: number; width: number; height: number };
type Face = { box: Box; pts: Pt[]; score: number };

/** The visitor's face, found once in the booth photo and reused after compositing. */
export type SourceFace = { rgb: Buffer; width: number; height: number; pts: Pt[]; closeUp: string };
export type TransferResult = { ok: true; image: string; mismatch: number } | { ok: false; reason: string };

// YuNet 2023mar (opencv_zoo, MIT). Landmarks: right eye, left eye, nose tip, mouth corners.
const MODEL_FILE = 'face_detection_yunet_2023mar.onnx';
const DETECT_MAX_SIDE = 1600;
// Second detection on a crop where the face is about this wide, for precise landmarks.
const REFINE_FACE_PX = 200;
const MIN_SCORE = 0.75;

// Guards, from test composites: good alignments leave a landmark error of 4-5% of the eye
// distance and a head-turn difference up to 0.13. Beyond these the drawn head is turned,
// tilted or has another expression, and pasting a frontal face there would look wrong.
const MAX_RESIDUAL = 0.09;
const MAX_YAW_DIFF = 0.2;
const MIN_EYE_DISTANCE = 14;
// Share of the scene's soft light carried onto the pasted face (0 = none, 1 = all).
const SHADING = 0.6;
// Share of the inner face whose soft color still differs strongly after color matching.
// Clean transfers measured 0.00-0.35; a hat brim shadow across the eyes measured 0.55.
// Above the limit something covers the face and the composite is kept.
const MAX_MISMATCH = Number(process.env.PHOTOBOOTH_FACE_MAX_MISMATCH) || 0.45;
const MISMATCH_DELTA = 25;

/* eslint-disable @typescript-eslint/no-explicit-any -- opencv-js is an Emscripten module */
let cvReady: Promise<any> | null = null;

function loadCv(): Promise<any> {
  if (!cvReady) {
    cvReady = (async () => {
      const mod: any = await import('@techstark/opencv-js');
      let cv = mod.default ?? mod;
      if (typeof cv.then === 'function') cv = await cv;
      else if (!cv.Mat) await new Promise<void>((resolve) => (cv.onRuntimeInitialized = resolve));
      const model = await readFile(join(process.cwd(), 'public', 'models', MODEL_FILE));
      try {
        cv.FS_createDataFile('/', MODEL_FILE, new Uint8Array(model), true, false, false);
      } catch {
        // Already written by an earlier module evaluation (dev reloads share the runtime).
      }
      return cv;
    })();
    cvReady.catch(() => {
      cvReady = null;
    });
  }
  return cvReady;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const decode = (dataUrl: string) => Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
const jpegUrl = (buf: Buffer) => 'data:image/jpeg;base64,' + buf.toString('base64');
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Runs YuNet on a raw RGB image and returns the largest confident face in its pixels. */
function detect(cv: any, rgb: Buffer, w: number, h: number): Face | null {
  const mats: any[] = [];
  try {
    const rgbMat = new cv.Mat(h, w, cv.CV_8UC3);
    mats.push(rgbMat);
    rgbMat.data.set(rgb);
    const bgr = new cv.Mat();
    mats.push(bgr);
    cv.cvtColor(rgbMat, bgr, cv.COLOR_RGB2BGR);
    const detector = new cv.FaceDetectorYN(MODEL_FILE, '', new cv.Size(w, h), MIN_SCORE, 0.3, 20);
    mats.push(detector);
    const faces = new cv.Mat();
    mats.push(faces);
    detector.detect(bgr, faces);

    let best: Face | null = null;
    for (let i = 0; i < faces.rows; i++) {
      const r = faces.data32F.slice(i * 15, i * 15 + 15);
      const box = { left: r[0], top: r[1], width: r[2], height: r[3] };
      if (r[14] < MIN_SCORE || (best && box.width * box.height <= best.box.width * best.box.height)) continue;
      const pts = [0, 1, 2, 3, 4].map((k) => ({ x: r[4 + k * 2], y: r[5 + k * 2] }));
      best = { box, pts, score: r[14] };
    }
    return best;
  } finally {
    for (const mat of mats) mat.delete();
  }
}

const mapFace = (face: Face, scale: number, dx = 0, dy = 0): Face => ({
  box: { left: face.box.left / scale + dx, top: face.box.top / scale + dy, width: face.box.width / scale, height: face.box.height / scale },
  pts: face.pts.map((p) => ({ x: p.x / scale + dx, y: p.y / scale + dy })),
  score: face.score,
});

/**
 * Largest confident face in a raw RGB image, in full-resolution pixels. A second pass on a
 * crop scaled so the face is about REFINE_FACE_PX wide gives landmarks precise enough to
 * line up glasses and eyes (small faces otherwise misalign by a few pixels).
 */
async function findFace(cv: any, rgb: Buffer, width: number, height: number): Promise<Face | null> {
  const raw = { raw: { width, height, channels: 3 as const } };
  const scale = Math.min(1, DETECT_MAX_SIDE / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const small = scale < 1 ? await sharp(rgb, raw).resize(w, h).raw().toBuffer() : rgb;
  const coarse = detect(cv, small, w, h);
  if (!coarse) return null;
  const found = mapFace(coarse, scale);

  const side = Math.round(Math.min(width, height, Math.max(found.box.width, found.box.height) * 3));
  const cropBox = {
    left: Math.round(clamp(found.box.left + found.box.width / 2 - side / 2, 0, width - side)),
    top: Math.round(clamp(found.box.top + found.box.height / 2 - side / 2, 0, height - side)),
    width: side,
    height: side,
  };
  const zoom = clamp(REFINE_FACE_PX / found.box.width, 0.5, 4);
  const size = Math.round(side * zoom);
  const crop = await sharp(rgb, raw).extract(cropBox).resize(size, size, { kernel: 'lanczos3' }).raw().toBuffer();
  const fine = detect(cv, crop, size, size);
  return fine ? mapFace(fine, size / side, cropBox.left, cropBox.top) : found;
}

/** Head-and-hair portrait crop around the face box. */
function headBox(face: Box, width: number, height: number): Box {
  const cx = face.left + face.width / 2;
  const cy = face.top + face.height / 2;
  const side = Math.max(face.width, face.height) * 1.9;
  const w = Math.min(width, side);
  const h = Math.min(height, side * 1.1);
  const left = Math.round(clamp(cx - w / 2, 0, width - w));
  const top = Math.round(clamp(cy - h * 0.45, 0, height - h));
  return { left, top, width: Math.round(w), height: Math.round(h) };
}

/** Finds the visitor's face in the booth photo; null when there is no clear face. */
export async function analyzeFace(photoDataUrl: string): Promise<SourceFace | null> {
  const cv = await loadCv();
  const { data, info } = await sharp(decode(photoDataUrl)).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const face = await findFace(cv, data, info.width, info.height);
  if (!face) return null;
  const closeUp = await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } })
    .extract(headBox(face.box, info.width, info.height))
    .resize({ width: 768, height: 845, fit: 'cover', kernel: 'lanczos3' })
    .jpeg({ quality: 92 })
    .toBuffer();
  return { rgb: data, width: info.width, height: info.height, pts: face.pts, closeUp: jpegUrl(closeUp) };
}

/** Least-squares rotation + uniform scale + translation mapping src points onto dst points. */
function similarity(src: Pt[], dst: Pt[]) {
  const ms = src.reduce((a, p) => ({ x: a.x + p.x / src.length, y: a.y + p.y / src.length }), { x: 0, y: 0 });
  const md = dst.reduce((a, p) => ({ x: a.x + p.x / dst.length, y: a.y + p.y / dst.length }), { x: 0, y: 0 });
  let ss = 0;
  let dot = 0;
  let cross = 0;
  src.forEach((p, i) => {
    const sx = p.x - ms.x;
    const sy = p.y - ms.y;
    const dx = dst[i].x - md.x;
    const dy = dst[i].y - md.y;
    ss += sx * sx + sy * sy;
    dot += sx * dx + sy * dy;
    cross += sx * dy - sy * dx;
  });
  const a = dot / ss;
  const b = cross / ss;
  return { a, b, tx: md.x - (a * ms.x - b * ms.y), ty: md.y - (b * ms.x + a * ms.y) };
}

/** Nose offset along the eye line, in eye distances: a rough head-turn measure. */
function yaw(pts: Pt[]) {
  const eyes = mid(pts[0], pts[1]);
  const iod = dist(pts[0], pts[1]);
  return ((pts[2].x - eyes.x) * (pts[1].x - pts[0].x) + (pts[2].y - eyes.y) * (pts[1].y - pts[0].y)) / (iod * iod);
}

function channelStats(lab: Float32Array, mask: Float32Array) {
  const sum = [0, 0, 0];
  const sq = [0, 0, 0];
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] < 0.6) continue;
    n++;
    for (let c = 0; c < 3; c++) {
      const v = lab[i * 3 + c];
      sum[c] += v;
      sq[c] += v * v;
    }
  }
  const mean = sum.map((s) => s / Math.max(n, 1));
  const std = sq.map((s, c) => Math.sqrt(Math.max(s / Math.max(n, 1) - mean[c] * mean[c], 1e-6)));
  return { mean, std, n };
}

/**
 * Puts the visitor's real face onto the drawn face of the composite.
 * tight narrows the blend to brows, eyes, nose and mouth for poses with hands beside the
 * face and for headwear that sits on the forehead.
 */
export async function transferFace(source: SourceFace, compositeUrl: string, options: { tight?: boolean } = {}): Promise<TransferResult> {
  const cv = await loadCv();
  const { data: dst, info } = await sharp(decode(compositeUrl)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const face = await findFace(cv, dst, W, H);
  if (!face) return { ok: false, reason: 'no face in the composite' };

  const s = source.pts;
  const d = face.pts;
  const iod = dist(d[0], d[1]);
  if (iod < MIN_EYE_DISTANCE) return { ok: false, reason: 'face too small (' + iod.toFixed(0) + ' px)' };
  const M = similarity(s, d);
  const residual = Math.sqrt(s.reduce((acc, p, i) => acc + (M.a * p.x - M.b * p.y + M.tx - d[i].x) ** 2 + (M.b * p.x + M.a * p.y + M.ty - d[i].y) ** 2, 0) / s.length) / iod;
  if (residual > MAX_RESIDUAL) return { ok: false, reason: 'head angle or expression differs (residual ' + residual.toFixed(3) + ')' };
  const yawDiff = Math.abs(yaw(s) - yaw(d));
  if (yawDiff > MAX_YAW_DIFF) return { ok: false, reason: 'head turned (yaw ' + yawDiff.toFixed(2) + ')' };

  // Blend region: an ellipse over brows, eyes, nose, mouth and chin, feathered at the edge.
  const eyes = mid(d[0], d[1]);
  const mouth = mid(d[3], d[4]);
  const center = { x: eyes.x + (mouth.x - eyes.x) * 0.45, y: eyes.y + (mouth.y - eyes.y) * 0.45 };
  const ex = { x: (d[1].x - d[0].x) / iod, y: (d[1].y - d[0].y) / iod };
  const up = { x: ex.y, y: -ex.x };
  const rx = iod * (options.tight ? 0.78 : 0.95);
  const ry = iod * (options.tight ? 1.05 : 1.2);
  const sigma = iod * 0.2;
  const pad = ry + sigma * 3;
  const left = Math.floor(clamp(center.x - pad, 0, W - 1));
  const top = Math.floor(clamp(center.y - pad, 0, H - 1));
  const rw = Math.ceil(clamp(center.x + pad, 1, W)) - left;
  const rh = Math.ceil(clamp(center.y + pad, 1, H)) - top;
  if (rw < 8 || rh < 8) return { ok: false, reason: 'face at the edge' };

  const mats: any[] = [];
  const track = <T,>(mat: T) => {
    mats.push(mat);
    return mat;
  };
  try {
    // Visitor's face warped into the region.
    const srcMat = track(new cv.Mat(source.height, source.width, cv.CV_8UC3));
    srcMat.data.set(source.rgb);
    const warp = track(cv.matFromArray(2, 3, cv.CV_64F, [M.a, -M.b, M.tx - left, M.b, M.a, M.ty - top]));
    const warped = track(new cv.Mat());
    cv.warpAffine(srcMat, warped, warp, new cv.Size(rw, rh), cv.INTER_LANCZOS4, cv.BORDER_REFLECT, new cv.Scalar());

    const roi = Buffer.alloc(rw * rh * 3);
    for (let y = 0; y < rh; y++) dst.copy(roi, y * rw * 3, ((top + y) * W + left) * 3, ((top + y) * W + left + rw) * 3);
    const dstMat = track(new cv.Mat(rh, rw, cv.CV_8UC3));
    dstMat.data.set(roi);

    const maskMat = track(cv.Mat.zeros(rh, rw, cv.CV_32FC1));
    const angle = (Math.atan2(ex.y, ex.x) * 180) / Math.PI;
    cv.ellipse(maskMat, new cv.Point(Math.round(center.x - left), Math.round(center.y - top)), new cv.Size(Math.round(rx), Math.round(ry)), angle, 0, 360, new cv.Scalar(1), -1, cv.LINE_AA);
    cv.GaussianBlur(maskMat, maskMat, new cv.Size(0, 0), sigma, sigma, cv.BORDER_DEFAULT);
    const mask = Float32Array.from(maskMat.data32F as Float32Array);
    if (options.tight) {
      // Keep the drawn forehead (headwear, saluting hand) and chin (hand on the chin, fists).
      const mouthBelow = ((mouth.x - eyes.x) * -up.x + (mouth.y - eyes.y) * -up.y) / iod;
      for (let y = 0; y < rh; y++) {
        for (let x = 0; x < rw; x++) {
          const above = ((x + left - eyes.x) * up.x + (y + top - eyes.y) * up.y) / iod;
          mask[y * rw + x] *= clamp((0.65 - above) / 0.3, 0, 1) * clamp((above + mouthBelow + 0.45) / 0.25, 0, 1);
        }
      }
    }

    // Color: match the drawn face's brightness, contrast and tint, then carry over its soft light.
    const toLab = (rgbMat: any) => {
      const lab8 = track(new cv.Mat());
      cv.cvtColor(rgbMat, lab8, cv.COLOR_RGB2Lab);
      return Float32Array.from(lab8.data as Uint8Array);
    };
    const wl = toLab(warped);
    const dl = toLab(dstMat);
    const ws = channelStats(wl, mask);
    const ds = channelStats(dl, mask);
    if (ws.n < 50) return { ok: false, reason: 'face region too small' };
    const gain = [clamp(ds.std[0] / ws.std[0], 0.7, 1.4), 1, 1];
    for (let i = 0; i < mask.length; i++) {
      for (let c = 0; c < 3; c++) wl[i * 3 + c] = (wl[i * 3 + c] - ws.mean[c]) * gain[c] + ds.mean[c];
    }

    const blur = (values: Float32Array, channels: 1 | 3) => {
      const mat = track(new cv.Mat(rh, rw, channels === 3 ? cv.CV_32FC3 : cv.CV_32FC1));
      mat.data32F.set(values);
      cv.GaussianBlur(mat, mat, new cv.Size(0, 0), iod * sigmaScale, iod * sigmaScale, cv.BORDER_REPLICATE);
      return Float32Array.from(mat.data32F as Float32Array);
    };
    let sigmaScale = 0.12;
    const bw = blur(wl, 3);
    const bd = blur(dl, 3);
    let differs = 0;
    let inside = 0;
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] < 0.6) continue;
      inside++;
      const de = Math.hypot(bw[i * 3] - bd[i * 3], bw[i * 3 + 1] - bd[i * 3 + 1], bw[i * 3 + 2] - bd[i * 3 + 2]);
      if (de > MISMATCH_DELTA) differs++;
    }
    const mismatch = differs / Math.max(inside, 1);
    if (mismatch > MAX_MISMATCH) return { ok: false, reason: 'face partly covered (mismatch ' + mismatch.toFixed(2) + ')' };

    sigmaScale = 0.3;
    const weighted = (lab: Float32Array) => lab.map((v, i) => v * mask[Math.floor(i / 3)]);
    const norm = blur(mask, 1);
    const lw = blur(weighted(wl), 3);
    const ld = blur(weighted(dl), 3);
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] < 0.01) continue;
      const n = norm[i] + 1e-4;
      for (let c = 0; c < 3; c++) wl[i * 3 + c] += ((ld[i * 3 + c] - lw[i * 3 + c]) / n) * SHADING;
    }

    const lab8 = track(new cv.Mat(rh, rw, cv.CV_8UC3));
    lab8.data.set(Uint8Array.from(wl, (v) => clamp(Math.round(v), 0, 255)));
    const faceRgb = track(new cv.Mat());
    cv.cvtColor(lab8, faceRgb, cv.COLOR_Lab2RGB);
    const pasted = faceRgb.data as Uint8Array;
    const out = Buffer.alloc(roi.length);
    for (let i = 0; i < mask.length; i++) {
      const m = mask[i];
      for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(pasted[i * 3 + c] * m + roi[i * 3 + c] * (1 - m));
    }

    const jpeg = await sharp(dst, { raw: { width: W, height: H, channels: 3 } })
      .composite([{ input: out, raw: { width: rw, height: rh, channels: 3 }, left, top }])
      .jpeg({ quality: 93 })
      .toBuffer();
    return { ok: true, image: jpegUrl(jpeg), mismatch };
  } finally {
    for (const mat of mats) (mat as any).delete();
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

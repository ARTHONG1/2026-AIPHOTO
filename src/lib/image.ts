// Browser-side image helpers. Photos are stored as JPEG, capped at 1536px so the
// model sees enough facial detail to keep the likeness.
import { FRAME_FONTS, PRINT, formatFrameDate, frameFontUrl, frameOverlayUrl, type FrameDef, type FrameFont } from '@/lib/frames';

export const PHOTO_ASPECT = 2 / 3; // portrait width / height
export const PHOTO_MAX_SIDE = 1536;

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

/** Center-crops a source to the portrait aspect and encodes a JPEG data URL. */
export function cropToPhoto(source: CanvasImageSource, width: number, height: number, mirror = false): string {
  let sw = width;
  let sh = height;
  if (width / height > PHOTO_ASPECT) sw = height * PHOTO_ASPECT;
  else sh = width / PHOTO_ASPECT;
  const scale = Math.min(1, PHOTO_MAX_SIDE / sh);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext('2d')!;
  if (mirror) {
    // Match the mirrored camera preview the visitor saw.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, (width - sw) / 2, (height - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.9);
}

/**
 * Display-only 4:5 pair for the before/after slider on the phone. The 2:3 original
 * loses a quarter of its excess height from the top and the rest from the bottom, so
 * a head near the top edge stays in view. Neither image is ever offered for download.
 */
export async function makeComparePair(original: string, result: string, width = 800): Promise<{ before: string; after: string }> {
  const draw = async (src: string, focusY: number) => {
    const img = await loadImage(src);
    const target = 4 / 5;
    let sw = img.naturalWidth;
    let sh = img.naturalHeight;
    if (sw / sh > target) sw = sh * target;
    else sh = sw / target;
    const scale = Math.min(1, width / sw);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    canvas.getContext('2d')!.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) * focusY, sw, sh, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.86);
  };
  return { before: await draw(original, 0.25), after: await draw(result, 0.5) };
}

export async function fileToPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return cropToPhoto(img, img.naturalWidth, img.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const loadedFonts = new Map<FrameFont, Promise<void>>();

/** Registers the small digit-only font a frame uses for its date (once per page). */
function loadFrameFont(font: FrameFont): Promise<void> {
  let pending = loadedFonts.get(font);
  if (!pending) {
    const { family, weight } = FRAME_FONTS[font];
    const face = new FontFace(family, 'url(' + frameFontUrl(font) + ')', { weight });
    pending = face.load().then((f) => void document.fonts.add(f)).catch(() => undefined);
    loadedFonts.set(font, pending);
  }
  return pending;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (r > 0) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/**
 * Lays the photo into a print frame: exactly 1200x1800 px (4x6 in at 300 dpi), the size
 * photo-booth printers expect, so the print is neither stretched nor letterboxed.
 */
export async function composePrint(imageUrl: string, frame: FrameDef, date = new Date()): Promise<string> {
  const [img, overlay] = await Promise.all([loadImage(imageUrl), loadImage(frameOverlayUrl(frame.id))]);
  if (frame.date) await loadFrameFont(frame.date.font);

  const canvas = document.createElement('canvas');
  canvas.width = PRINT.width;
  canvas.height = PRINT.height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Cover-fit the photo into the window; overflow is trimmed around frame.focusY.
  const p = frame.photo;
  const scale = Math.max(p.w / img.naturalWidth, p.h / img.naturalHeight);
  const sw = p.w / scale;
  const sh = p.h / scale;
  const sx = (img.naturalWidth - sw) / 2;
  const sy = (img.naturalHeight - sh) * frame.focusY;
  ctx.save();
  // Bleed 2 px under the frame edge so no white seam shows at the rounded corners.
  roundedRect(ctx, p.x - 2, p.y - 2, p.w + 4, p.h + 4, p.r + 2);
  ctx.clip();
  ctx.drawImage(img, sx, sy, sw, sh, p.x - 2, p.y - 2, p.w + 4, p.h + 4);
  ctx.restore();

  ctx.drawImage(overlay, 0, 0, canvas.width, canvas.height);

  if (frame.date) {
    const d = frame.date;
    const { family, weight } = FRAME_FONTS[d.font];
    ctx.font = weight + ' ' + d.size + 'px ' + family + ', "Malgun Gothic", sans-serif';
    ctx.textAlign = d.align;
    ctx.textBaseline = 'alphabetic';
    if (d.spacing) ctx.letterSpacing = d.spacing + 'px';
    ctx.fillStyle = d.color;
    if (d.glow) {
      ctx.shadowColor = d.glow;
      ctx.shadowBlur = d.size * 0.5;
    }
    ctx.fillText(formatFrameDate(date, d.format), d.x, d.y);
  }
  return withPrintDensity(canvas.toDataURL('image/jpeg', 0.94));
}

/**
 * Canvas JPEGs say 96 dpi, so some print dialogs pick the wrong size. Rewrites the JFIF
 * header to 300 dpi, which makes 1200x1800 px read as exactly 4x6 in.
 */
function withPrintDensity(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  const bytes = Uint8Array.from(atob(dataUrl.slice(comma + 1)), (c) => c.charCodeAt(0));
  const isJfif = bytes[2] === 0xff && bytes[3] === 0xe0 && String.fromCharCode(...bytes.subarray(6, 10)) === 'JFIF';
  if (!isJfif) return dataUrl;
  bytes[13] = 1; // units: dots per inch
  bytes[14] = PRINT.dpi >> 8;
  bytes[15] = PRINT.dpi & 0xff;
  bytes[16] = PRINT.dpi >> 8;
  bytes[17] = PRINT.dpi & 0xff;
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return dataUrl.slice(0, comma + 1) + btoa(binary);
}

/** Prints one image edge to edge on 4x6 in paper (the printer's borderless setting decides the bleed). */
export function printPhoto(dataUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(
      '<!doctype html><html><head><title>AI한컷</title><style>@page{size:4in 6in;margin:0}html,body{margin:0;padding:0}img{display:block;width:4in;height:6in}</style></head><body></body></html>'
    );
    doc.close();
    const img = doc.createElement('img');
    img.onload = () => {
      const win = iframe.contentWindow!;
      // Remove the iframe after the dialog closes; afterprint is not fired everywhere.
      const cleanup = () => setTimeout(() => iframe.remove(), 500);
      win.addEventListener('afterprint', cleanup, { once: true });
      setTimeout(cleanup, 60_000);
      win.focus();
      win.print();
      resolve();
    };
    img.onerror = () => {
      iframe.remove();
      reject(new Error('print image failed'));
    };
    img.src = dataUrl;
    doc.body.appendChild(img);
  });
}

export async function downloadDataUrl(dataUrl: string, filename: string) {
  const blob = await (await fetch(dataUrl)).blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

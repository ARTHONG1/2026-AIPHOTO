/**
 * Photobooth image composite flow (Vertex AI).
 * Inputs are preset ids; reference assets are resolved on the server only.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Part } from 'genkit';
import sharp from 'sharp';
import { FACE_TRANSFER, FALLBACK_IMAGE_MODEL_ID, IMAGE_MODEL_ID, IMAGE_SIZE, ai, imageModel } from '@/ai/genkit';
import { analyzeFace, transferFace, type SourceFace } from '@/ai/face';
import { MAX_PROPS, findBackground, findComposition, findPose, findProp, type Preset } from '@/lib/presets';

export type GenerateRequest = {
  photo: string;
  backgroundId?: string | null;
  poseId?: string | null;
  propIds?: string[];
  compositionId?: string | null;
};

export type GenerateResult = { ok: true; image: string } | { ok: false; error: string };

const PHOTO_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_PHOTO_CHARS = 8_000_000;

// Face transfer is skipped when something is drawn over the face itself.
const FACE_COVERING_PROPS = new Set(['cyber-helmet', 'vr-headset', 'safety-goggles', 'ai-glasses']);
const FACE_COVERING_POSES = new Set(['shush', 'binoculars']);
// Hands or headwear close to the face: blend only brows, eyes, nose and mouth.
const TIGHT_POSES = new Set(['v-sign', 'double-v', 'surprise', 'salute', 'think', 'head-scratch', 'boxing']);
const TIGHT_PROPS = new Set(['einstein-wig', 'graduation-cap', 'explorer-hat', 'circuit-crown', 'astronaut-helmet']);
// Lens and camera effects the model does not draw reliably are finished in code: it draws the
// scene straight (it copies the level background reference), so the Dutch tilt is a rotation
// of the whole picture plus a crop, and the fisheye is a barrel distortion of the result.
const COMPOSITION_FINISHERS: Record<string, (image: string) => Promise<string>> = {
  'dutch-angle': (image) => tiltImage(image, -12),
  fisheye: (image) => fisheyeImage(image, 0.45),
};

// Prompt order was compared on real Pro renders (synthetic subject, scene + pose + item):
// asking for "one on-location photograph" first, then identity, then each reference with a
// single role, fixed the pasted-cutout look and the pose mismatch of the older edit-style prompt.
// Putting the scene image before the base photo duplicated held items, so the photo stays first.
// Framing matters for likeness: head-to-knee shots drew the face ~70 px wide at 1K and the
// identity drifted (face similarity 0.49-0.69); waist-up framing kept it ~125 px (0.88).
// Keep the default close; only an explicitly selected wide composition makes the person small.
// A 4:5 render fits the print windows better than 2:3, leaving room for a larger full body.
const TASK = [
  '=== TASK: a photorealistic on-location photograph of PERSON A. PERSON A is the real person in the BASE PHOTO. Photograph PERSON A inside the SCENE as if a professional photographer shot one single frame there with one camera.',
  'The result must never look like a cutout pasted on a backdrop: PERSON A is the large foreground subject photographed inside the scene. Move the camera closer rather than shrinking PERSON A to fit the entire location reference; show only the relevant part of the scene around them.',
].join('\n');

// With a 4:5 render, the shortest print window trims less than 7% vertically.
// Keep hands/head below 6% and feet above 92%, rather than reserving 30% empty space.
const SUBJECT_SIZE =
  "Subject size: unless the chosen composition explicitly makes PERSON A small or requires extra space for a lens effect, PERSON A is the dominant foreground subject. For a full-body shot, aim for the complete silhouette including raised hands to fill about 86 percent of the image height, between 6 percent and 92 percent from the top edge. Keep every limb, hand and foot inside that area. For a wide pose with outstretched arms, fit the hands within 8 percent and 92 percent of the image width and use the largest body size that fits both dimensions, reducing height only as needed to keep natural proportions. Move the camera closer and crop the surrounding scene; do not enlarge the head separately or stretch the body. Keep realistic head-to-body proportions for PERSON A's age and build. For a portrait crop, the visible part of PERSON A likewise fills this area; do not pull back to include the legs.";

const DEFAULT_FRAMING =
  "=== DEFAULT CLOSE-UP: a tight portrait from just above the head to the upper chest. The head, face and shoulders dominate the photograph; leave only a little headroom and keep the eyes sharply focused. The scene is only a cropped, naturally softened glimpse behind the shoulders, enough to suggest the chosen location. Do not show the entire landscape, building or scene reference. Crop the waist and legs out. Show only the portion of the body pose visible in this close-up, even when the selected pose includes legs or outstretched arms. Do not move the camera back to fit the pose guide, hands, props or landmarks. Preserve the original face angle and expression. Never make a distant establishing shot.";

function framing(compositionId?: string | null): string {
  const composition = findComposition(compositionId);
  if (!composition) return DEFAULT_FRAMING;
  return (
    '=== COMPOSITION (camera framing chosen by the visitor, must match): ' + composition.prompt + '.\n' +
    'The composition decides what is inside the frame and where the camera stands. Keep the original face angle and expression unless this particular composition explicitly requires a different view of the head. Even then preserve the facial anatomy and expression; never substitute a generic face. If it crops part of the pose, show the visible part of the pose correctly.\n' +
    SUBJECT_SIZE
  );
}

const IDENTITY = [
  '=== IDENTITY LOCK (highest priority): do not create a new person. Keep PERSON A recognizably identical: facial geometry and proportions, eye shape and spacing, eyebrows, nose, lips, jawline, cheekbones, skin tone, age, hairline, hairstyle and hair color, glasses, moles and body build.',
  'Treat the BASE PHOTO and its FACE CLOSE-UP as photographs to preserve, not inspiration for a similar-looking character. Reuse the original facial features and their small asymmetries as faithfully as possible; change only the lighting needed to belong to the scene.',
  'Keep the head angle and facial expression from the BASE PHOTO unless the selected camera composition explicitly requires a different head view. A body pose never authorizes changing the face, gaze, smile or mouth shape. Do not beautify, slim, de-age or replace the face. Keep the clothing unless an item replaces it.',
  'For non-human subjects (toys, robots, drawings) keep their exact shape, medium and colors.',
].join('\n');

const LIGHT = [
  '=== LIGHT AND CAMERA (this is what makes it real):',
  "- Adapt the lighting to the scene: consistent direction, softness and color temperature on skin, hair and clothing, with subtle bounce and rim light only where appropriate. Preserve the original facial geometry, skin texture, skin tone and glasses; relighting must not redraw facial features or hide the eyes in deep shadow. Keep the face naturally exposed.",
  '- Contact shadows under the feet and shadows cast by held items. Correct perspective and horizon for the camera height.',
  '- One lens for the whole frame: PERSON A in sharp focus, the background with natural depth of field; matching sharpness, noise and grain everywhere; clean hair and shoulder edges with no halo or outline.',
  '- High detail: crisp eyes and glasses, natural skin texture (no plastic smoothing), real fabric folds.',
  '- Scene physics (floating hair underwater, wind, glow from lava or lightning) may move hair tips and fabric while the hairstyle stays recognizable.',
].join('\n');

const RULES =
  '=== RULES: each item appears exactly once (never duplicate an item into both hands). Identity preservation has priority over scene styling. The pose guide controls body and limbs only and has priority over the items. If an item needs a hand, hold it in the hand that keeps the pose unchanged, or wear it. Remove any date stamp, text, watermark or frame from the BASE PHOTO and add none. No extra people. Output one vertical 4:5 photograph.';

const MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

// Every background and prop ships a reference image; the model receives the image itself.
async function presetMedia(preset: Preset): Promise<Part> {
  if (!preset.ref) throw new Error('Preset ' + preset.id + ' has no reference image');
  const bytes = await readFile(join(process.cwd(), 'public', preset.ref.slice(1)));
  const contentType = MIME[preset.ref.split('.').pop() ?? ''] ?? 'image/png';
  return { media: { url: 'data:' + contentType + ';base64,' + bytes.toString('base64'), contentType } };
}

export function validateRequest(input: GenerateRequest): string | null {
  if (typeof input?.photo !== 'string' || input.photo.length > MAX_PHOTO_CHARS || !PHOTO_PATTERN.test(input.photo)) {
    return '사진을 읽을 수 없어요. 다시 찍어 주세요.';
  }
  if (input.backgroundId && !findBackground(input.backgroundId)) return '알 수 없는 배경입니다.';
  if (input.poseId && !findPose(input.poseId)) return '알 수 없는 동작입니다.';
  if (input.compositionId && !findComposition(input.compositionId)) return '알 수 없는 구도입니다.';
  const propIds = input.propIds ?? [];
  if (!Array.isArray(propIds) || propIds.length > MAX_PROPS || propIds.some((id) => !findProp(id))) {
    return '소품 선택이 올바르지 않습니다.';
  }
  if (!input.backgroundId && !input.poseId && propIds.length === 0 && !input.compositionId) {
    return '배경, 동작, 소품, 구도 중 하나 이상을 골라 주세요.';
  }
  return null;
}

export async function buildParts(input: GenerateRequest, face?: string | null): Promise<Part[]> {
  const photoType = input.photo.slice(5, input.photo.indexOf(';'));
  const parts: Part[] = [
    { text: TASK + '\n' + framing(input.compositionId) },
    { text: '=== BASE PHOTO (PERSON A, the only identity source)' },
    { media: { url: input.photo, contentType: photoType } },
  ];
  if (face) {
    parts.push(
      { text: '=== FACE CLOSE-UP cropped from the SAME BASE PHOTO, not a second person or a second capture. This is the authoritative reference for the exact facial features, expression, glasses and skin texture. Preserve these details in the result; do not copy the indoor background or lighting.' },
      { media: { url: face, contentType: 'image/jpeg' } }
    );
  }
  parts.push({ text: IDENTITY });

  const background = findBackground(input.backgroundId);
  if (background) {
    parts.push(
      {
        text:
          '=== SCENE: ' + background.prompt + '. The next image identifies the location, colors and mood, not the camera framing. Show only the portion visible behind PERSON A at the chosen framing; landmarks may be partly cropped or entirely outside the frame. You do not need to reproduce every object or show the complete background reference. Move the camera within this place so PERSON A fits naturally; do not paste the image as a flat backdrop.',
      },
      await presetMedia(background)
    );
  } else {
    parts.push({ text: '=== SCENE: keep the original place from the BASE PHOTO.' });
  }

  const pose = findPose(input.poseId);
  if (pose) {
    parts.push(
      {
        text:
          '=== POSE (must match): ' + pose.prompt + '. The next image is only a stick-figure guide for the direction of the arms, hands, legs and torso. Match those limb directions exactly; never copy its drawing style, head, facial expression, body proportions, size within the guide image or colors. Keep PERSON A large according to the photograph framing, regardless of the blank space around the guide.',
      },
      await presetMedia(pose)
    );
  } else {
    parts.push({ text: '=== POSE: keep the original pose and expression from the BASE PHOTO.' });
  }

  for (const id of input.propIds ?? []) {
    const prop = findProp(id)!;
    parts.push(
      {
        text:
          '=== ITEM: PERSON A is ' + prop.prompt + '. The next image is only the item reference: use that exact item (shape, colors, details) at real-world size with a real grip or fit, lit by the scene. Ignore its white product backdrop.',
      },
      await presetMedia(prop)
    );
  }

  parts.push({ text: LIGHT }, { text: RULES }, { text: '=== FINAL FRAMING CHECK (applies to the photograph, not the pose guide):\n' + framing(input.compositionId) });
  return parts;
}

async function renderImage(modelId: string, prompt: Part[]): Promise<string | null> {
  const { media } = await ai.generate({
    model: imageModel(modelId),
    // 4:5 matches the print windows closely: less trimming, larger person at the same 1K tier.
    config: { responseModalities: ['IMAGE', 'TEXT'], imageConfig: { aspectRatio: '4:5', imageSize: IMAGE_SIZE } },
    prompt,
  });
  return media?.url ?? null;
}

const isQuota = (message: string) => /quota|429|RESOURCE_EXHAUSTED/i.test(message);
const isSafety = (message: string) => /safety|blocked|PROHIBITED/i.test(message);

/** One generation pass on the main model; a fallback model is tried only if one is configured. */
async function renderWithFallback(prompt: Part[]): Promise<string | null> {
  try {
    return await renderImage(IMAGE_MODEL_ID, prompt);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isSafety(message) || !FALLBACK_IMAGE_MODEL_ID || FALLBACK_IMAGE_MODEL_ID === IMAGE_MODEL_ID) throw error;
    console.warn('[generatePhoto] primary model failed, using fallback', message.slice(0, 200));
    return renderImage(FALLBACK_IMAGE_MODEL_ID, prompt);
  }
}

async function safeAnalyzeFace(photo: string): Promise<SourceFace | null> {
  try {
    return await analyzeFace(photo);
  } catch (error) {
    console.warn('[generatePhoto] face analysis skipped', error);
    return null;
  }
}

/** Puts the visitor's real face back on the composite; any failure keeps the composite as is. */
async function safeTransferFace(face: SourceFace, image: string, input: GenerateRequest): Promise<string> {
  const propIds = input.propIds ?? [];
  if (FACE_COVERING_POSES.has(input.poseId ?? '') || propIds.some((id) => FACE_COVERING_PROPS.has(id))) return image;
  const tight = TIGHT_POSES.has(input.poseId ?? '') || propIds.some((id) => TIGHT_PROPS.has(id));
  try {
    const result = await transferFace(face, image, { tight });
    if (result.ok) return result.image;
    console.info('[generatePhoto] face transfer skipped:', result.reason);
  } catch (error) {
    console.warn('[generatePhoto] face transfer failed', error instanceof Error ? error.message.slice(0, 200) : error);
  }
  return image;
}

/** Rotates the whole picture and crops the largest upright frame of the same size ratio. */
async function tiltImage(image: string, degrees: number): Promise<string> {
  const input = Buffer.from(image.slice(image.indexOf(',') + 1), 'base64');
  const { width = 0, height = 0 } = await sharp(input).metadata();
  if (!width || !height) return image;
  const t = (Math.abs(degrees) * Math.PI) / 180;
  const zoom = Math.cos(t) + (Math.max(width, height) / Math.min(width, height)) * Math.sin(t);
  const rotated = await sharp(input).rotate(degrees, { background: '#000000' }).toBuffer({ resolveWithObject: true });
  const cropW = Math.floor(width / zoom);
  const cropH = Math.floor(height / zoom);
  const output = await sharp(rotated.data)
    .extract({
      left: Math.floor((rotated.info.width - cropW) / 2),
      top: Math.floor((rotated.info.height - cropH) / 2),
      width: cropW,
      height: cropH,
    })
    .resize(width, height)
    .png()
    .toBuffer();
  return 'data:image/png;base64,' + output.toString('base64');
}

/**
 * Barrel (fisheye) distortion: the centre swells toward the viewer and the edges curve away.
 * Each output pixel samples the source at radius r^(1+strength) (r = 0..1 to the corner), so the
 * corners stay in place, plus a soft lens vignette.
 */
async function fisheyeImage(image: string, strength: number): Promise<string> {
  const input = Buffer.from(image.slice(image.indexOf(',') + 1), 'base64');
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const out = Buffer.alloc(w * h * ch);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const R = Math.hypot(cx, cy);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / R;
      const dy = (y - cy) / R;
      const r = Math.hypot(dx, dy);
      const k = r > 0 ? Math.pow(r, strength) : 0;
      const sx = Math.min(w - 1.001, Math.max(0, cx + dx * k * R));
      const sy = Math.min(h - 1.001, Math.max(0, cy + dy * k * R));
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;
      const shade = 1 - 0.35 * r * r * r;
      const o = (y * w + x) * ch;
      const a = (y0 * w + x0) * ch;
      const b = a + ch;
      const c = a + w * ch;
      const d = c + ch;
      for (let i = 0; i < ch; i++) {
        const top = data[a + i] + (data[b + i] - data[a + i]) * fx;
        const bottom = data[c + i] + (data[d + i] - data[c + i]) * fx;
        out[o + i] = Math.round((top + (bottom - top) * fy) * shade);
      }
    }
  }
  const png = await sharp(out, { raw: { width: w, height: h, channels: ch } }).png().toBuffer();
  return 'data:image/png;base64,' + png.toString('base64');
}

async function finishComposition(image: string, compositionId?: string | null): Promise<string> {
  const finish = compositionId ? COMPOSITION_FINISHERS[compositionId] : undefined;
  if (!finish) return image;
  try {
    return await finish(image);
  } catch (error) {
    console.warn('[generatePhoto] composition finish skipped', error instanceof Error ? error.message.slice(0, 200) : error);
    return image;
  }
}

export async function generatePhoto(input: GenerateRequest): Promise<GenerateResult> {
  const invalid = validateRequest(input);
  if (invalid) return { ok: false, error: invalid };

  // Rehearsal mode: returns the original photo without calling Vertex AI.
  if (process.env.PHOTOBOOTH_MOCK_AI === '1') {
    await new Promise((r) => setTimeout(r, 2500));
    return { ok: true, image: input.photo };
  }

  try {
    // The face is optional: without a detected face the flow still works on the base photo.
    const face = await safeAnalyzeFace(input.photo);
    const composite = await renderWithFallback(await buildParts(input, face?.closeUp));
    if (!composite) return { ok: false, error: 'AI가 이미지를 만들지 못했어요. 다른 조합으로 다시 시도해 주세요.' };
    const image = face && FACE_TRANSFER ? await safeTransferFace(face, composite, input) : composite;
    return { ok: true, image: await finishComposition(image, input.compositionId) };
  } catch (error) {
    console.error('[generatePhoto] Vertex AI error', error);
    const message = error instanceof Error ? error.message : String(error);
    if (isQuota(message)) return { ok: false, error: '지금 요청이 많아요. 잠시 후 다시 시도해 주세요.' };
    if (isSafety(message)) return { ok: false, error: '이 조합은 만들 수 없어요. 다른 선택으로 시도해 주세요.' };
    return { ok: false, error: '이미지 생성 중 문제가 생겼어요. 다시 시도해 주세요.' };
  }
}

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
// That waist-up framing stays the default; a composition chosen by the visitor replaces it,
// so a long shot trades some likeness (and usually the face transfer) for the wide view.
const TASK = [
  '=== TASK: a photorealistic on-location photograph of PERSON A. PERSON A is the real person in the BASE PHOTO. Photograph PERSON A inside the SCENE as if a professional photographer shot one single frame there with one camera.',
  'The result must never look like a cutout pasted on a backdrop: PERSON A stands inside the scene at a natural scale, with the scene visible around them.',
].join('\n');

const DEFAULT_FRAMING =
  "Framing: a medium shot from the top of the head to about mid-thigh, so PERSON A's face is large, sharp and clearly recognizable. Show the full body only when the pose needs the legs (jumping, kicking, running, squatting or balancing on one leg), and even then keep the camera as close as the pose allows.";

function framing(compositionId?: string | null): string {
  const composition = findComposition(compositionId);
  if (!composition) return DEFAULT_FRAMING;
  return (
    '=== COMPOSITION (camera framing chosen by the visitor, must match): ' + composition.prompt + '.\n' +
    'The composition decides what is inside the frame and where the camera stands; it overrides the head angle of the BASE PHOTO but never the identity. If it crops part of the pose, show the visible part of the pose correctly.\n' +
    SUBJECT_SIZE
  );
}

// Full-body compositions without a stated size came back with a small figure (under half the
// frame height). The print frames trim about 6 % off the top and 16 % off the bottom of the 2:3
// photo, so the body is placed high enough for the feet to survive that crop.
const SUBJECT_SIZE =
  "Subject size: unless the composition above states how small PERSON A is, PERSON A is the main subject and is large in the frame. In a full-body shot the body (including raised hands) fills about 70 percent of the frame height, from about one tenth below the top edge to about one fifth above the bottom edge, centered, with every limb, hand and foot complete inside the frame. Keep realistic body proportions for PERSON A's age and build; never shrink the body under a large head.";

const IDENTITY = [
  '=== IDENTITY LOCK (highest priority): do not create a new person. Keep PERSON A recognizably identical: facial geometry and proportions, eye shape and spacing, eyebrows, nose, lips, jawline, cheekbones, skin tone, age, hairline, hairstyle and hair color, glasses, moles and body build.',
  'Keep the head angle and facial expression from the BASE PHOTO. Do not beautify, slim, de-age or replace the face. Keep the clothing unless an item replaces it.',
  'For non-human subjects (toys, robots, drawings) keep their exact shape, medium and colors.',
].join('\n');

const LIGHT = [
  '=== LIGHT AND CAMERA (this is what makes it real):',
  "- Completely replace the flat indoor light of the BASE PHOTO with the scene's own light: same direction, softness and color temperature on the face, skin, hair and clothing, plus colored bounce light from the surroundings and a rim light where the scene is backlit.",
  '- Contact shadows under the feet and shadows cast by held items. Correct perspective and horizon for the camera height.',
  '- One lens for the whole frame: PERSON A in sharp focus, the background with natural depth of field; matching sharpness, noise and grain everywhere; clean hair and shoulder edges with no halo or outline.',
  '- High detail: crisp eyes and glasses, natural skin texture (no plastic smoothing), real fabric folds.',
  '- Scene physics (floating hair underwater, wind, glow from lava or lightning) may move hair tips and fabric while the hairstyle stays recognizable.',
].join('\n');

const RULES =
  '=== RULES: each item appears exactly once (never duplicate an item into both hands). The pose guide has priority over the items. If an item needs a hand, hold it in the hand that keeps the pose unchanged, or wear it. Remove any date stamp, text, watermark or frame from the BASE PHOTO and add none. No extra people. Output one vertical 2:3 photograph.';

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
      { text: '=== FACE CLOSE-UP of PERSON A (same person; identity reference for the face only)' },
      { media: { url: face, contentType: 'image/jpeg' } }
    );
  }
  parts.push({ text: IDENTITY });

  const background = findBackground(input.backgroundId);
  if (background) {
    parts.push(
      {
        text:
          '=== SCENE: ' + background.prompt + '. The next image is the location reference: keep its landmarks, plants, colors and mood. You may move the camera within this place so PERSON A fits naturally; do not paste the image as a flat backdrop.',
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
          '=== POSE (must match): ' + pose.prompt + '. The next image is only a stick-figure guide for the direction of the arms, hands, legs and torso. Match those limb directions exactly; never copy its drawing style, head or colors.',
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

  parts.push({ text: LIGHT }, { text: RULES });
  return parts;
}

async function renderImage(modelId: string, prompt: Part[]): Promise<string | null> {
  const { media } = await ai.generate({
    model: imageModel(modelId),
    // 2:3 matches the captured photo; 1K keeps a visitor's wait near 30 s on Pro.
    config: { responseModalities: ['IMAGE', 'TEXT'], imageConfig: { aspectRatio: '2:3', imageSize: IMAGE_SIZE } },
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

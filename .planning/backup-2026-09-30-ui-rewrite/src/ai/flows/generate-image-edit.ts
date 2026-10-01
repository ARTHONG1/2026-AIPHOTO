/**
 * Photobooth image composite flow (Vertex AI).
 * Inputs are preset ids; reference assets are resolved on the server only.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Part } from 'genkit';
import { FALLBACK_IMAGE_MODEL_ID, IMAGE_MODEL_ID, IMAGE_SIZE, ai, imageModel } from '@/ai/genkit';
import { faceCloseUp } from '@/ai/face';
import { MAX_PROPS, findBackground, findPose, findProp, type Preset } from '@/lib/presets';

export type GenerateRequest = {
  photo: string;
  backgroundId?: string | null;
  poseId?: string | null;
  propIds?: string[];
};

export type GenerateResult = { ok: true; image: string } | { ok: false; error: string };

const PHOTO_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_PHOTO_CHARS = 8_000_000;

// Structure follows Google's Nano Banana Pro guidance: state that this is an edit (not a
// new person), lock concrete facial features first, give every image one role, then list
// the edits, style and a conflict rule. Asking to "redraw the whole person" invented new faces.
const LOCK = [
  '=== LOCK (highest priority): this is an image-editing task on the BASE PHOTO, not the creation of a new person or a replacement face. PERSON A is the person in the BASE PHOTO.',
  "Preserve PERSON A's exact identity: facial geometry and proportions, eye shape, spacing and color, eyebrows, nose, lips, jawline, cheekbones, chin, forehead, skin tone and natural skin texture, age, hairline, hairstyle and hair color, glasses, moles and other distinctive marks, and body build.",
  'Keep the face as it appears in the BASE PHOTO: same head angle, face orientation and expression. Do not beautify, de-age, slim, reshape, symmetrize or replace the face, and never turn it into a generic model face. Keep every piece of clothing that is not explicitly replaced.',
  'For non-human subjects (toys, robots, drawings) keep their exact shape, medium and colors.',
].join('\n');

const EDIT_HEADER = '=== EDIT: change only the items listed below. Every other image is a reference for one thing only and must never influence the face.';

const STYLE = [
  '=== STYLE: one photorealistic photograph, as if PERSON A was photographed on location with a single camera.',
  '- Blend PERSON A into the scene only through lighting and color grading (light direction, color temperature, contrast, rim light), never by changing facial features.',
  "- Match the skin tone of the neck, arms, hands and legs to PERSON A's face so the body looks like one person.",
  '- Correct perspective and realistic scale, soft contact shadows, and clean edges with no cutout halo, white fringe or sticker outline.',
  '- Scene physics (floating hair underwater, wind, glow from lava or lightning) may move hair tips and fabric while the hairstyle stays recognizable.',
].join('\n');

const CONSTRAINT =
  "=== CONSTRAINT: do not alter any locked element. If a requested change conflicts with the likeness, prioritize PERSON A's facial identity over the pose, scene and items. Do not add unrequested people, objects, text, logos, watermarks or frames. Output one vertical 2:3 photograph.";

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
  const propIds = input.propIds ?? [];
  if (!Array.isArray(propIds) || propIds.length > MAX_PROPS || propIds.some((id) => !findProp(id))) {
    return '소품 선택이 올바르지 않습니다.';
  }
  if (!input.backgroundId && !input.poseId && propIds.length === 0) return '배경, 동작, 소품 중 하나 이상을 골라 주세요.';
  return null;
}

export async function buildParts(input: GenerateRequest, face?: string | null): Promise<Part[]> {
  const photoType = input.photo.slice(5, input.photo.indexOf(';'));
  const parts: Part[] = [
    { text: LOCK },
    { text: '=== BASE PHOTO (PERSON A, the only identity source)' },
    { media: { url: input.photo, contentType: photoType } },
  ];
  if (face) {
    parts.push(
      { text: '=== FACE CLOSE-UP of PERSON A (same person as the BASE PHOTO; identity reference for the face only)' },
      { media: { url: face, contentType: 'image/jpeg' } }
    );
  }
  parts.push({ text: EDIT_HEADER });

  const background = findBackground(input.backgroundId);
  if (background) {
    parts.push(
      {
        text:
          '=== SCENE: ' + background.prompt + '. The next image is ONLY the location reference. Recreate this place with its layout, landmarks and colors, reframed for a vertical portrait so PERSON A stands naturally inside it (not in front of a flat backdrop).',
      },
      await presetMedia(background)
    );
  } else {
    parts.push({ text: '=== SCENE: keep the original background from the base photo.' });
  }

  const pose = findPose(input.poseId);
  if (pose) {
    parts.push(
      {
        text:
          "=== POSE: change only PERSON A's arms, hands, legs and torso to: " + pose.prompt + '. Keep the head position, face angle and expression from the BASE PHOTO. The next image is ONLY a stick-figure guide for limb directions; never borrow its head, body shape, hands, line style or colors.',
      },
      await presetMedia(pose)
    );
  } else {
    parts.push({ text: '=== POSE: keep the original pose and expression from the base photo.' });
  }

  for (const id of input.propIds ?? []) {
    const prop = findProp(id)!;
    parts.push(
      {
        text:
          '=== ITEM: PERSON A is ' + prop.prompt + ". The next image is ONLY the item reference: use that exact item (shape, colors, logos, details) and ignore its plain product-photo backdrop. It must be physically worn or held with real size, natural folds, a real grip and the scene lighting. The item must not change PERSON A's face.",
      },
      await presetMedia(prop)
    );
  }

  parts.push({ text: STYLE }, { text: CONSTRAINT });
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

/** One generation pass; if the primary model is busy or unavailable, retry once on the fallback. */
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

async function safeFaceCloseUp(photo: string) {
  try {
    return await faceCloseUp(photo);
  } catch (error) {
    console.warn('[generatePhoto] face close-up skipped', error);
    return null;
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
    // The close-up is optional: without a detected face the flow still works on the base photo.
    const face = await safeFaceCloseUp(input.photo);
    const image = await renderWithFallback(await buildParts(input, face));
    if (!image) return { ok: false, error: 'AI가 이미지를 만들지 못했어요. 다른 조합으로 다시 시도해 주세요.' };
    return { ok: true, image };
  } catch (error) {
    console.error('[generatePhoto] Vertex AI error', error);
    const message = error instanceof Error ? error.message : String(error);
    if (isQuota(message)) return { ok: false, error: '지금 요청이 많아요. 잠시 후 다시 시도해 주세요.' };
    if (isSafety(message)) return { ok: false, error: '이 조합은 만들 수 없어요. 다른 선택으로 시도해 주세요.' };
    return { ok: false, error: '이미지 생성 중 문제가 생겼어요. 다시 시도해 주세요.' };
  }
}

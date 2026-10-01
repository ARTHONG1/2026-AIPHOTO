
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import type { Part } from 'genkit';
import { ai, imageModel } from '@/ai/genkit';
import { faceCloseUp } from '@/ai/face';
import { findBackground, findPose, findProp, type Preset } from '@/lib/presets';

const Q = process.env.PHQ as string;
const [name, model = 'gemini-3-pro-image', size = '1K'] = process.argv.slice(2);
const MIME: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
async function media(p: Preset): Promise<Part> {
  const bytes = await readFile(join(process.cwd(), 'public', p.ref!.slice(1)));
  const ct = MIME[p.ref!.split('.').pop()!] ?? 'image/png';
  return { media: { url: 'data:' + ct + ';base64,' + bytes.toString('base64'), contentType: ct } };
}

const TASK = [
  '=== TASK: a photorealistic on-location photograph of PERSON A. PERSON A is the real person in the BASE PHOTO. Photograph PERSON A inside the SCENE as if a professional photographer shot one single frame there with one camera.',
  'The result must never look like a cutout pasted on a backdrop: PERSON A stands on the ground inside the scene, at a natural distance and scale, framed from head to at least the knees.',
].join('\n');

const IDENTITY = [
  '=== IDENTITY LOCK (highest priority): do not create a new person. Keep PERSON A recognizably identical: facial geometry and proportions, eye shape and spacing, eyebrows, nose, lips, jawline, cheekbones, skin tone, age, hairline, hairstyle and hair color, glasses, moles and body build.',
  'Keep the head angle and facial expression from the BASE PHOTO. Do not beautify, slim, de-age or replace the face. Keep the clothing unless an item replaces it.',
].join('\n');

const LIGHT = [
  '=== LIGHT AND CAMERA (this is what makes it real):',
  "- Completely replace the flat indoor light of the BASE PHOTO with the scene's own light: same direction, softness and color temperature on the face, skin, hair and clothing, plus colored bounce light from the surroundings and a rim light where the scene is backlit.",
  '- Contact shadows under the feet and shadows cast by held items. Correct perspective and horizon for the camera height.',
  '- One lens for the whole frame: PERSON A in sharp focus, the background with natural depth of field; matching sharpness, noise and grain everywhere; clean hair and shoulder edges with no halo or outline.',
  '- High detail: crisp eyes and glasses, natural skin texture (no plastic smoothing), real fabric folds.',
].join('\n');

const RULES =
  '=== RULES: the pose guide has priority over the items. If an item needs a hand, hold it in the hand that keeps the pose unchanged, or wear it. Remove any date stamp, text, watermark or frame from the BASE PHOTO and add none. No extra people. Output one vertical 2:3 photograph.';

(async () => {
  const photo = 'data:image/jpeg;base64,' + (await readFile(Q + '/subject.jpg')).toString('base64');
  const t0 = Date.now();
  const face = await faceCloseUp(photo).catch(() => null);
  const bg = findBackground(process.env.BG || 'rainforest')!;
  const pose = findPose(process.env.POSE || 't-pose')!;
  const props = (process.env.PROPS || 'dino-fossil').split(',').filter(Boolean).map((id) => findProp(id)!);
  const parts: Part[] = [
    { text: TASK },
    { text: '=== SCENE: ' + bg.prompt + '. The next image is the location where the new photograph is taken: keep its landmarks, plants, colors, light and mood. You may move the camera within this place so PERSON A fits naturally.' },
    await media(bg),
    { text: '=== BASE PHOTO (PERSON A, the only identity source; its flat indoor background and light are discarded)' },
    { media: { url: photo, contentType: 'image/jpeg' } },
  ];
  if (face) parts.push({ text: '=== FACE CLOSE-UP of PERSON A (same person; identity reference for the face only)' }, { media: { url: face, contentType: 'image/jpeg' } });
  parts.push({ text: IDENTITY });
  parts.push({ text: '=== POSE (must match): ' + pose.prompt + '. The next image is only a stick-figure guide for the direction of the arms, hands, legs and torso. Match those limb directions exactly; never copy its drawing style, head or colors.' }, await media(pose));
  for (const p of props) parts.push({ text: '=== ITEM: PERSON A is ' + p.prompt + '. The next image is only the item reference: use that exact item (shape, colors, details) at real-world size with a real grip or fit, lit by the scene. Ignore its white product backdrop.' }, await media(p));
  parts.push({ text: LIGHT }, { text: RULES });
  const t1 = Date.now();
  const { media: out } = await ai.generate({ model: imageModel(model), config: { responseModalities: ['IMAGE', 'TEXT'], imageConfig: { aspectRatio: '2:3', imageSize: size as '1K' | '2K' } }, prompt: parts });
  const buf = Buffer.from(out!.url.split(',')[1], 'base64');
  await writeFile(Q + '/' + name + '.png', buf);
  const m = await sharp(buf).metadata();
  console.log(name, 'face', Boolean(face), 'render', ((Date.now() - t1) / 1000).toFixed(1) + 's', 'total', ((Date.now() - t0) / 1000).toFixed(1) + 's', m.width + 'x' + m.height);
})().catch((e) => { console.error('ERR', String(e?.message || e).slice(0, 600)); process.exit(1); });



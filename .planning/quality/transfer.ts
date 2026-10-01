// Quality check for the booth flow on the synthetic subject.
//   full run:      tsx .planning/quality/transfer.ts <name>            (composite + face transfer)
//   transfer only: tsx .planning/quality/transfer.ts <name> <file.png> (reuses an existing composite)
// Env: PHQ=<test dir with subject.jpg>, BG, POSE, PROPS.
import { readFile, writeFile } from 'node:fs/promises';
import { ai, imageModel, IMAGE_MODEL_ID, IMAGE_SIZE } from '@/ai/genkit';
import { buildParts } from '@/ai/flows/generate-image-edit';
import { analyzeFace, transferFace } from '@/ai/face';

const Q = process.env.PHQ as string;
const [name, existing] = process.argv.slice(2);
const save = (url: string, file: string) => writeFile(Q + '/' + file, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
const s = (a: number, b: number) => ((b - a) / 1000).toFixed(1) + 's';

(async () => {
  const photo = 'data:image/jpeg;base64,' + (await readFile(Q + '/subject.jpg')).toString('base64');
  const t0 = Date.now();
  const face = await analyzeFace(photo);
  const t1 = Date.now();
  let composite: string;
  if (existing) {
    composite = 'data:image/png;base64,' + (await readFile(Q + '/' + existing)).toString('base64');
  } else {
    const input = { photo, backgroundId: process.env.BG || 'rainforest', poseId: process.env.POSE || 't-pose', propIds: (process.env.PROPS || '').split(',').filter(Boolean) };
    const { media } = await ai.generate({
      model: imageModel(IMAGE_MODEL_ID),
      config: { responseModalities: ['IMAGE', 'TEXT'], imageConfig: { aspectRatio: '2:3', imageSize: IMAGE_SIZE } },
      prompt: await buildParts(input, face?.closeUp),
    });
    composite = media!.url;
    await save(composite, name + '-a.png');
  }
  const t2 = Date.now();
  const result = face ? await transferFace(face, composite, { tight: process.env.TIGHT === '1' }) : { ok: false as const, reason: 'no face in subject' };
  const t3 = Date.now();
  if (result.ok) await save(result.image, name + '-b.jpg');
  console.log(name, 'analyze', s(t0, t1), 'composite', s(t1, t2), 'transfer', s(t2, t3), result.ok ? 'ok mismatch ' + result.mismatch.toFixed(2) : 'skip: ' + result.reason, 'total', s(t0, t3), 'rss', Math.round(process.memoryUsage().rss / 1e6) + 'MB');
})().catch((e) => { console.error(name, 'ERR', String(e?.stack || e).slice(0, 800)); process.exit(1); });

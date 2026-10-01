
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { ai, imageModel } from '@/ai/genkit';
import { buildParts } from '@/ai/flows/generate-image-edit';
import { faceCloseUp } from '@/ai/face';

const Q = process.env.PHQ as string;
const mode = process.argv[2];
const model = process.argv[3] || 'gemini-3-pro-image';
const size = (process.argv[4] || '1K') as '1K' | '2K';

async function saveMedia(url: string, name: string) {
  const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
  await writeFile(Q + '/' + name, buf);
  const meta = await sharp(buf).metadata();
  console.log('saved', name, meta.width + 'x' + meta.height, buf.length);
}

(async () => {
  const t0 = Date.now();
  if (mode === 'subject') {
    const { media } = await ai.generate({
      model: imageModel(model),
      config: { responseModalities: ['IMAGE', 'TEXT'], imageConfig: { aspectRatio: '2:3', imageSize: '1K' } },
      prompt: 'Candid webcam photo taken at a school science fair booth: a fictional Korean man in his mid 20s with short black hair and black rectangular glasses, plain light mint t-shirt and dark jeans, standing straight facing the camera with arms relaxed at his sides, full body visible from head to knees, neutral indoor fluorescent lighting, plain beige wall behind him, slight webcam noise. Vertical photo.',
    });
    await saveMedia(media!.url, 'subject.png');
    const jpg = await sharp(Buffer.from(media!.url.split(',')[1], 'base64')).resize(640, 960, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer();
    await writeFile(Q + '/subject.jpg', jpg);
  } else {
    const photo = 'data:image/jpeg;base64,' + (await readFile(Q + '/subject.jpg')).toString('base64');
    const face = await faceCloseUp(photo).catch((e) => { console.log('face err', String(e).slice(0, 200)); return null; });
    console.log('face', Boolean(face), ((Date.now() - t0) / 1000).toFixed(1) + 's');
    const parts = await buildParts({ photo, backgroundId: process.env.BG || 'rainforest', poseId: process.env.POSE || 't-pose', propIds: (process.env.PROPS || 'dino-fossil').split(',').filter(Boolean) }, face);
    const t1 = Date.now();
    const { media } = await ai.generate({
      model: imageModel(model),
      config: { responseModalities: ['IMAGE', 'TEXT'], imageConfig: { aspectRatio: '2:3', imageSize: size } },
      prompt: parts,
    });
    console.log('render', ((Date.now() - t1) / 1000).toFixed(1) + 's');
    await saveMedia(media!.url, mode + '.png');
  }
  console.log('total', ((Date.now() - t0) / 1000).toFixed(1) + 's');
})().catch((e) => { console.error('ERR', String(e?.message || e).slice(0, 600)); process.exit(1); });



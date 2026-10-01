
import { readFile, writeFile } from 'node:fs/promises';
import { generatePhoto } from '@/ai/flows/generate-image-edit';
const Q = process.env.PHQ as string;
(async () => {
  const photo = 'data:image/jpeg;base64,' + (await readFile(Q + '/subject.jpg')).toString('base64');
  const t0 = Date.now();
  const res = await generatePhoto({ photo, backgroundId: process.env.BG || 'rainforest', poseId: process.env.POSE || 't-pose', propIds: (process.env.PROPS || 'dino-fossil').split(',').filter(Boolean) });
  if (!res.ok) { console.log('FAIL', res.error); process.exit(1); }
  await writeFile(Q + '/' + process.argv[2] + '.png', Buffer.from(res.image.split(',')[1], 'base64'));
  console.log(process.argv[2], 'ok', ((Date.now() - t0) / 1000).toFixed(1) + 's');
})();


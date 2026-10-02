import { readFile, writeFile } from 'node:fs/promises';
import { generatePhoto } from '@/ai/flows/generate-image-edit';
// Composition check: same subject, scene and pose; only the camera framing changes.
const Q = process.env.PHQ as string;
(async () => {
  const photo = 'data:image/jpeg;base64,' + (await readFile(Q + '/subject.jpg')).toString('base64');
  const t0 = Date.now();
  const compositionId = process.argv[2] === 'none' ? null : process.argv[2];
  const res = await generatePhoto({ photo, backgroundId: process.env.BG || 'mars-base', poseId: process.env.POSE || 'wave', propIds: [], compositionId });
  if (!res.ok) { console.log('FAIL', res.error); process.exit(1); }
  await writeFile(Q + '/comp-' + process.argv[2] + '.png', Buffer.from(res.image.split(',')[1], 'base64'));
  console.log(process.argv[2], 'ok', ((Date.now() - t0) / 1000).toFixed(1) + 's');
})();

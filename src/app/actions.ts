'use server';

import crypto from 'node:crypto';
import { generatePhoto, type GenerateRequest, type GenerateResult } from '@/ai/flows/generate-image-edit';
import { uploadLivePhoto } from '@/lib/storage';

export async function generatePhotoAction(input: GenerateRequest): Promise<GenerateResult> {
  return generatePhoto(input);
}

export type UploadResult = { ok: true; url: string; id: string; photoUrl: string } | { ok: false; error: string };

const IMAGE_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export async function uploadForQrAction(
  image: string,
  meta: { frameId?: string; backgroundId?: string; poseId?: string; propIds?: string[] } = {}
): Promise<UploadResult> {
  if (typeof image !== 'string' || image.length > 12_000_000 || !IMAGE_PATTERN.test(image)) {
    return { ok: false, error: '이미지를 올릴 수 없어요.' };
  }
  try {
    const id = crypto.randomBytes(6).toString('base64url');
    const comma = image.indexOf(',');
    const buffer = Buffer.from(image.slice(comma + 1), 'base64');
    const { photoUrl } = await uploadLivePhoto(id, buffer, {
      frameId: meta.frameId || 'festival',
      backgroundId: meta.backgroundId,
      poseId: meta.poseId,
      propIds: meta.propIds,
    });
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ai-hancut--project-1e3fbae0-3a3e-4723-ae1.asia-east1.hosted.app';
    const liveUrl = baseUrl + '/live/' + id;
    return { ok: true, url: liveUrl, id, photoUrl };
  } catch (error) {
    console.error('[uploadForQrAction] upload failed:', error);
    return { ok: false, error: 'AR 라이브 포토 생성에 실패했어요. 다운로드를 이용해 주세요.' };
  }
}


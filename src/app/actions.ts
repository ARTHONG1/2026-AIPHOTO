'use server';

import { v2 as cloudinary } from 'cloudinary';
import { generatePhoto, type GenerateRequest, type GenerateResult } from '@/ai/flows/generate-image-edit';

export async function generatePhotoAction(input: GenerateRequest): Promise<GenerateResult> {
  return generatePhoto(input);
}

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

const IMAGE_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export async function uploadForQrAction(image: string): Promise<UploadResult> {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return { ok: false, error: 'QR 받기가 아직 설정되지 않았어요. 다운로드를 이용해 주세요.' };
  }
  if (typeof image !== 'string' || image.length > 12_000_000 || !IMAGE_PATTERN.test(image)) {
    return { ok: false, error: '이미지를 올릴 수 없어요.' };
  }
  cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET, secure: true });
  try {
    const uploaded = await cloudinary.uploader.upload(image, { folder: 'ai-hancut' });
    return { ok: true, url: cloudinary.url(uploaded.public_id, { flags: 'attachment', fetch_format: 'auto', secure: true }) };
  } catch (error) {
    console.error('[uploadForQr] Cloudinary upload failed', error);
    return { ok: false, error: 'QR 코드를 만들지 못했어요. 다운로드를 이용해 주세요.' };
  }
}

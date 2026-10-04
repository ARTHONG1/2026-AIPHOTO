'use server';

import { generatePhoto, type GenerateRequest, type GenerateResult } from '@/ai/flows/generate-image-edit';

export async function generatePhotoAction(input: GenerateRequest): Promise<GenerateResult> {
  return generatePhoto(input);
}

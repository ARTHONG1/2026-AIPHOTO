'use server';

import { generateImageEdit, type GenerateImageEditInput } from "@/ai/flows/generate-image-edit";

// This is a server action that can be called from client components.
export async function generateImageAction(input: GenerateImageEditInput & { apiKey: string }) {
  const { apiKey, ...flowInput } = input;
  return await generateImageEdit(apiKey, flowInput);
}

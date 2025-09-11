
'use server';

import { generateImageEdit, type GenerateImageEditInput } from "@/ai/flows/generate-image-edit";
import { v2 as cloudinary } from 'cloudinary';

// This is a server action that can be called from client components.
export async function generateImageAction(input: GenerateImageEditInput & { apiKey: string }) {
  const { apiKey, ...flowInput } = input;
  return await generateImageEdit(apiKey, flowInput);
}

export async function uploadImageToCloudinaryAction(imageData: string): Promise<string | null> {
  cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

  try {
    const uploadResult = await cloudinary.uploader.upload(imageData, {
      folder: 'magic-markup' // Optional: organize uploads in a specific folder
    });
    return uploadResult.secure_url;
  } catch (error) {
    console.error("Cloudinary upload failed on server:", error);
    return null;
  }
}

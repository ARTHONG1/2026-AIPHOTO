
'use server';

import { generateImageEdit, type GenerateImageEditInput } from "@/ai/flows/generate-image-edit";
import { v2 as cloudinary } from 'cloudinary';

export async function generateImageAction(input: GenerateImageEditInput) {
  return await generateImageEdit(input);
}

export async function uploadImageToCloudinaryAction(imageData: string): Promise<string | null> {
  cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

  try {
    const uploadResult = await cloudinary.uploader.upload(imageData, {
      folder: 'magic-markup'
    });
    
    const downloadUrl = cloudinary.url(uploadResult.public_id, {
      flags: 'attachment',
      fetch_format: 'auto'
    });

    return downloadUrl;
  } catch (error) {
    console.error("Cloudinary upload failed:", error);
    return null;
  }
}

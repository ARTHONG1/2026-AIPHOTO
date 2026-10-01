import { genkit } from 'genkit';
import { vertexAI } from '@genkit-ai/google-genai';

// Project and region come from the environment on App Hosting; the fallback keeps
// existing local setups working without extra configuration.
export const ai = genkit({
  plugins: [
    vertexAI({
      projectId: process.env.GOOGLE_CLOUD_PROJECT || 'project-1e3fbae0-3a3e-4723-ae1',
      location: process.env.GOOGLE_CLOUD_LOCATION || 'global',
    }),
  ],
});

// Measured on the booth flow (synthetic subjects, 1 reference face + 3 references):
//   gemini-3.1-flash-image 1K: 12-16 s, likeness on par with Pro
//   gemini-3-pro-image     1K: ~28 s,  2K: ~60 s
// Pro is the default because it composes several reference images (scene, pose, props)
// more reliably; one visitor waits about 30 s. Flash is the fallback when Pro is busy.
export const IMAGE_MODEL_ID = process.env.PHOTOBOOTH_IMAGE_MODEL || 'gemini-3-pro-image';
export const FALLBACK_IMAGE_MODEL_ID = process.env.PHOTOBOOTH_FALLBACK_MODEL || 'gemini-3.1-flash-image';
export const IMAGE_SIZE = (process.env.PHOTOBOOTH_IMAGE_SIZE || '1K') as '1K' | '2K';
export const imageModel = (id: string) => vertexAI.model(id);
export const IMAGE_MODEL = imageModel(IMAGE_MODEL_ID);

// Fast vision model used only to locate the face for the identity close-up.
export const VISION_MODEL = vertexAI.model(process.env.PHOTOBOOTH_VISION_MODEL || 'gemini-2.5-flash');

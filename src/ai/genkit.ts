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

// The booth uses Pro only: it composes several reference images (scene, pose, props) more
// reliably. Measured on the booth flow at 1K: usually 23-36 s, up to ~70 s under load; 2K ~60 s.
export const IMAGE_MODEL_ID = process.env.PHOTOBOOTH_IMAGE_MODEL || 'gemini-3-pro-image';
// Optional second model, used only when the main model returns an error. Empty = Pro only.
export const FALLBACK_IMAGE_MODEL_ID = process.env.PHOTOBOOTH_FALLBACK_MODEL || '';
export const IMAGE_SIZE = (process.env.PHOTOBOOTH_IMAGE_SIZE || '1K') as '1K' | '2K';
export const imageModel = (id: string) => vertexAI.model(id);
export const IMAGE_MODEL = imageModel(IMAGE_MODEL_ID);

// Local face transfer after compositing (src/ai/face.ts, about 1 s, no API call).
// PHOTOBOOTH_FACE_TRANSFER=0 turns it off.
export const FACE_TRANSFER = process.env.PHOTOBOOTH_FACE_TRANSFER !== '0';

'use server';

/**
 * @fileOverview Vertex AI 기반 기본 이미지 생성 플로우.
 */

import { genkit } from 'genkit';
import { vertexAI } from '@genkit-ai/vertexai';
import { z } from 'genkit';

const vAIPlugin = vertexAI({ 
  projectId: 'project-1e3fbae0-3a3e-4723-ae1',
  location: 'global' 
});

const ai = genkit({
  plugins: [vAIPlugin],
});

const GenerateBaseImageInputSchema = z.object({
  prompt: z.string().describe('Image generation prompt'),
});

const GenerateBaseImageOutputSchema = z.object({
  generatedImage: z.string().describe('Generated image data URI'),
});

export async function generateBaseImage(input: z.infer<typeof GenerateBaseImageInputSchema>): Promise<z.infer<typeof GenerateBaseImageOutputSchema>> {
  try {
    const { media } = await ai.generate({
      model: 'google/gemini-2.5-flash-image',
      config: { responseModalities: ['IMAGE'] },
      prompt: `Hyper-realistic, 4K studio photograph of: ${input.prompt}`,
    });

    if (!media?.url) throw new Error('Model failed to return an image.');
    return { generatedImage: media.url };
  } catch (error: any) {
    console.error('--- [Server] Base Image Generation Error ---', error);
    throw new Error(`기본 이미지 생성 실패: ${error.message}`);
  }
}

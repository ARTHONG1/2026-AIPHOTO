
'use server';

/**
 * @fileOverview Vertex AI 기반 기본 이미지 생성 플로우.
 */

import { genkit } from 'genkit';
import { vertexAI } from '@genkit-ai/vertexai';
import { z } from 'genkit';

const ai = genkit({
  plugins: [vertexAI({ location: 'global' })],
});

const GenerateBaseImageInputSchema = z.object({
  prompt: z.string().describe('Image generation prompt'),
});

const GenerateBaseImageOutputSchema = z.object({
  generatedImage: z.string().describe('Generated image data URI'),
});

export type GenerateBaseImageInput = z.infer<typeof GenerateBaseImageInputSchema>;
export type GenerateBaseImageOutput = z.infer<typeof GenerateBaseImageOutputSchema>;

export async function generateBaseImage(input: GenerateBaseImageInput): Promise<GenerateBaseImageOutput> {
  try {
    const { media } = await ai.generate({
      model: 'gemini-3-pro-image',
      config: { responseModalities: ['IMAGE'] },
      prompt: `Hyper-realistic, 4K studio photograph of: ${input.prompt}`,
    });

    if (!media?.url) throw new Error('Model failed to return an image.');
    return { generatedImage: media.url };
  } catch (error: any) {
    console.error('Vertex AI Base Image Error:', error);
    throw new Error(`기본 이미지 생성 실패: ${error.message}`);
  }
}

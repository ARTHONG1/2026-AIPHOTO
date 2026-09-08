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

export async function generateBaseImage(input: z.infer<typeof GenerateBaseImageInputSchema>): Promise<z.infer<typeof GenerateBaseImageOutputSchema>> {
  try {
    const { media } = await ai.generate({
      model: vertexai.model('gemini-3-pro-image'),
      config: { responseModalities: ['IMAGE'] },
      prompt: `Hyper-realistic, 4K studio photograph of: ${input.prompt}`,
    });

    if (!media?.url) throw new Error('Model failed to return an image.');
    return { generatedImage: media.url };
  } catch (error: any) {
    console.error('--- Base Image Generation Error ---');
    console.error(error);
    throw new Error(`기본 이미지 생성 실패: ${error.message}`);
  }
}

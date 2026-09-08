
'use server';

/**
 * @fileOverview Vertex AI (global) 기반 이미지 편집 플로우.
 * 최신 Genkit 1.x 모델 참조 방식을 사용합니다.
 */

import { genkit } from 'genkit';
import { vertexAI } from '@genkit-ai/vertexai';
import { z } from 'genkit';

const vAI = vertexAI({ location: 'global' });
const ai = genkit({
  plugins: [vAI],
});

const ImagePayloadSchema = z.object({
  url: z.string(),
  contentType: z.string(),
});

const GenerateImageEditInputSchema = z.object({
  baseImage: z.string().describe("Original Image data URI (base64)"),
  annotatedImage: z.string().optional().describe("Annotated guide image data URI"),
  elementImages: z.array(z.object({ name: z.string(), url: z.string(), contentType: z.string() })).max(3).optional(),
  customPrompt: z.string().optional(),
  actionPrompt: z.string().optional(),
  backgroundPrompt: z.string().optional(),
  backgroundImageUrl: ImagePayloadSchema.optional(),
});

const GenerateImageEditOutputSchema = z.object({
  editedImage: z.string().describe('Edited image data URI'),
});

export type GenerateImageEditInput = z.infer<typeof GenerateImageEditInputSchema>;
export type GenerateImageEditOutput = z.infer<typeof GenerateImageEditOutputSchema>;

const imageEditPrompt = ai.definePrompt({
  name: 'imageEditPrompt',
  model: vAI.model('gemini-3-pro-image'),
  config: { responseModalities: ['IMAGE'] },
  input: { schema: GenerateImageEditInputSchema },
  prompt: `You are an expert AI image editor. Final image must be hyper-realistic, 4K resolution.

=== Base Image
{{media url=baseImage}}

=== Instructions
{{#if customPrompt}}Custom Request: {{{customPrompt}}}{{/if}}
{{#if actionPrompt}}Action: {{{actionPrompt}}}{{/if}}
{{#if backgroundImageUrl}}
Background Image: {{media url=backgroundImageUrl.url}}
{{else if backgroundPrompt}}
Background Description: {{{backgroundPrompt}}}
{{/if}}

=== Annotations
{{#if annotatedImage}}
User Guide: {{media url=annotatedImage}} (Follow the highlights)
{{/if}}

Preserve identity, match lighting perfectly.`,
});

export async function generateImageEdit(input: GenerateImageEditInput): Promise<GenerateImageEditOutput> {
  console.log('--- [Server] generateImageEdit Start ---');
  try {
    const { media } = await imageEditPrompt(input);
    
    if (!media?.url) {
      throw new Error('Model failed to return an image URL.');
    }
    
    return { editedImage: media.url };
  } catch (error: any) {
    console.error('--- [Server] Vertex AI Error ---', error);
    throw new Error(`이미지 생성 실패: Vertex AI 오류 (${error.message || '알 수 없는 오류'})`);
  }
}

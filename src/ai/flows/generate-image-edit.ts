
'use server';

/**
 * @fileOverview Vertex AI (global) 기반 이미지 편집 플로우.
 * 상세 디버깅 로깅이 추가되었습니다.
 */

import { genkit } from 'genkit';
import { vertexAI } from '@genkit-ai/vertexai';
import { z } from 'genkit';

const ai = genkit({
  plugins: [vertexAI({ location: 'global' })],
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
  model: 'vertexai/gemini-3-pro-image',
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
  console.log('--- [Server] generateImageEdit Internal Start ---');
  console.log('Model Name: vertexai/gemini-3-pro-image');
  
  try {
    const { media } = await imageEditPrompt(input);
    
    if (!media?.url) {
      console.error('--- [Server] Model Response Error: No Media URL ---');
      throw new Error('Model failed to return an image URL.');
    }
    
    console.log('--- [Server] generateImageEdit Success ---');
    return { editedImage: media.url };
  } catch (error: any) {
    console.error('--- [Server] CRITICAL VERTEX AI ERROR ---');
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    
    // API 응답 객체가 있는 경우 상세 내용 확인 시도
    if (error.response) {
      try {
        const rawResponse = await error.response.text();
        console.error('Raw API Response Body:', rawResponse.substring(0, 1000));
      } catch (e) {
        console.error('Could not read raw response body');
      }
    }

    throw new Error(`이미지 생성 실패: Vertex AI 오류 (${error.message || '알 수 없는 서버 오류'})`);
  }
}

'use server';

/**
 * @fileOverview Vertex AI (global) 기반 이미지 편집 플로우.
 * gemini-3-pro-image 모델을 사용하여 초고해상도 편집 이미지를 생성합니다.
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
  model: vertexAI.model('gemini-3-pro-image'),
  config: { responseModalities: ['IMAGE'] },
  input: { schema: GenerateImageEditInputSchema },
  prompt: `You are an expert AI image editor. Your absolute priority is to preserve the facial identity of the person in the 'Base Image'. Do not change facial features except for enhancing a beautiful, natural smile.

Final image must be hyper-realistic, 4K resolution, indistinguishable from a professional photograph.

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
User Guide: {{media url=annotatedImage}} (Follow the highlights, do not include them in final result)
{{/if}}

=== Element Images
{{#if elementImages.length}}
{{#each elementImages}}
{{{this.name}}}: {{media url=this.url}}
{{/each}}
{{/if}}

Preserve identity, enhance smile, match lighting perfectly.`,
});

export async function generateImageEdit(input: GenerateImageEditInput): Promise<GenerateImageEditOutput> {
  try {
    const { media } = await imageEditPrompt(input);
    if (!media?.url) throw new Error('Model failed to return an image.');
    return { editedImage: media.url };
  } catch (error: any) {
    console.error('Vertex AI Error Details:', error);
    throw new Error(`이미지 생성 실패: Vertex AI 오류 (${error.message})`);
  }
}

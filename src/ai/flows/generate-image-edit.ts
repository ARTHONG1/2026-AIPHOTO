
'use server';

/**
 * @fileOverview Vertex AI (global) 기반 이미지 편집 플로우.
 * 최신 Genkit 1.x 모델 참조 방식 및 모달리티 설정을 사용합니다.
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
  config: { 
    responseModalities: ['IMAGE', 'TEXT'] 
  },
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
  console.log('--- [Server] generateImageEdit Start (Vertex AI) ---');
  try {
    const { media } = await imageEditPrompt(input);
    
    if (!media?.url) {
      throw new Error('Vertex AI 모델이 이미지를 반환하지 않았습니다. (응답 확인 필요)');
    }
    
    return { editedImage: media.url };
  } catch (error: any) {
    console.error('--- [Server] Vertex AI Critical Error ---', error);
    // 상세 에러 메시지를 포함하여 클라이언트로 전달
    throw new Error(`이미지 생성 실패: Vertex AI 오류 (${error.message || '알 수 없는 오류'}). 요청 endpoint와 권한을 확인하세요.`);
  }
}

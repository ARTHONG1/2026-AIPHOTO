'use server';

/**
 * @fileOverview Vertex AI (global) 기반 이미지 편집 플로우.
 * Genkit 1.x 표준 및 vertexAI.model() 헬퍼를 사용합니다.
 */

import { genkit } from 'genkit';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PREDEFINED_PROMPTS, ACTIONS, BACKGROUNDS } from '@/lib/image-presets';
import { vertexAI } from '@genkit-ai/google-genai';
import { z } from 'genkit';

const vAIPlugin = vertexAI({
  projectId: 'project-1e3fbae0-3a3e-4723-ae1',
  location: 'global'
});

const ai = genkit({
  plugins: [vAIPlugin],
});

const ImagePayloadSchema = z.object({
  url: z.string(),
  contentType: z.string(),
});

const GenerateImageEditInputSchema = z.object({
  baseImage: z.string().describe("Original Image data URI (base64)"),
  annotatedImage: z.string().optional().describe("Annotated guide image data URI"),
  elementImages: z.array(z.object({ name: z.string(), url: z.string(), contentType: z.string() })).max(4).optional(),
  customPrompt: z.string().optional(),
  actionPrompt: z.string().optional(),
  backgroundPrompt: z.string().optional(),
  backgroundImageUrl: ImagePayloadSchema.optional(),
  actionImageUrl: ImagePayloadSchema.optional(),
});

const GenerateImageEditOutputSchema = z.object({
  editedImage: z.string().describe('Edited image data URI'),
});

export type GenerateImageEditInput = z.infer<typeof GenerateImageEditInputSchema>;
export type GenerateImageEditOutput = z.infer<typeof GenerateImageEditOutputSchema>;

const imageEditPrompt = ai.definePrompt({
  name: 'imageEditPrompt',
  model: vertexAI.model('gemini-3-pro-image'),
  config: {
    responseModalities: ['IMAGE', 'TEXT']
  },
  input: { schema: GenerateImageEditInputSchema },
  prompt: `Composite the provided source image with the selected reference assets. Treat the first image as the immutable identity and shape source. Preserve the original subject medium, exact head and body geometry, proportions, facial features, and colors, including for toys, robots, illustrations, and non-human subjects. Do not turn a block-shaped robot into a rounded human or mannequin. For photographs, produce a natural photographic composite. The base image is the sole identity reference: preserve the same person, facial structure, age, skin tone, hairstyle, and all clothing not explicitly selected for replacement. Do not beautify or redesign the subject.

=== Base Image
{{media url=baseImage}}

=== Instructions
{{#if customPrompt}}Custom Request: {{{customPrompt}}}{{/if}}
{{#if actionPrompt}}Action: {{{actionPrompt}}}{{/if}}
{{#if backgroundImageUrl}}
Use this exact background scene, preserving its recognizable layout and details. Adapt only perspective, scale, light, and shadows for a natural composite. Background reference: {{media url=backgroundImageUrl.url}}
{{else if backgroundPrompt}}
Background Description: {{{backgroundPrompt}}}
{{/if}}

=== Pose reference
{{#if actionImageUrl}}
This image is ONLY a skeleton/gesture guide. Transfer only the directions and joint angles of the arms and legs to the BASE subject. NEVER borrow the head, torso shape, hands, costume, surface, proportions, or drawing style from this pose diagram. Preserve the BASE subject geometry and facial identity; identity takes priority over exact pose matching.
{{media url=actionImageUrl.url}}
{{/if}}

=== Selected objects and clothing
{{#each elementImages}}
Reference item: {{{name}}}
{{media url=url}}
Use this exact item: retain its shape, colors, patterns, logos, and details. Fit it naturally to the subject with correct scale, perspective, contact, occlusion, and shadows. Do not invent a similar substitute.
{{/each}}

=== Annotations
{{#if annotatedImage}}
User Guide: {{media url=annotatedImage}} (Follow the highlights)
{{/if}}

Change only the requested background, pose, and selected items. Preserve identity and reference-item fidelity. Do not add unrequested objects, lettering, symbols, or decorative overlays. Return the edited image.`,
});

// Resolve only known, shared UI presets; never read a client-supplied filesystem path.
async function presetMedia(preset: { imageUrl: string }) {
  const bytes = await readFile(join(process.cwd(), 'public', preset.imageUrl.slice(1)));
  const contentType = preset.imageUrl.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
  return { url: 'data:' + contentType + ';base64,' + bytes.toString('base64'), contentType };
}

export async function generateImageEdit(input: GenerateImageEditInput): Promise<GenerateImageEditOutput> {
  console.log('--- [Server] generateImageEdit Start (Vertex AI global) ---');
  try {
    const background = BACKGROUNDS.find(p => input.backgroundPrompt === p.name || input.backgroundPrompt === 'Background: ' + p.name);
    const action = ACTIONS.find(p => input.actionPrompt === p.name || input.actionPrompt === 'Pose: ' + p.name);
    const selectedItem = PREDEFINED_PROMPTS.find(p => input.customPrompt === p.name);
    const elementImages = [...(input.elementImages ?? [])];
    if (selectedItem) elementImages.unshift({ name: selectedItem.name, ...await presetMedia(selectedItem) });
    const promptInput = {
      ...input,
      backgroundImageUrl: input.backgroundImageUrl ?? (background ? await presetMedia(background) : undefined),
      actionImageUrl: input.actionImageUrl ?? (action ? await presetMedia(action) : undefined),
      elementImages,
    };
    console.log('[Image references]', { background: Boolean(promptInput.backgroundImageUrl), pose: Boolean(promptInput.actionImageUrl), items: elementImages.length });
    const { media } = await imageEditPrompt(promptInput);

    if (!media?.url) {
      throw new Error('Vertex AI 모델이 이미지를 반환하지 않았습니다.');
    }

    return { editedImage: media.url };
  } catch (error: any) {
    console.error('--- [Server] Vertex AI Critical Error ---', error);
    throw new Error(`이미지 생성 실패: Vertex AI 오류 (${error.message || '알 수 없는 오류'}).`);
  }
}

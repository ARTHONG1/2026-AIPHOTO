/**
 * Text-to-image flow kept for Genkit dev tooling.
 */
import { z } from 'genkit';
import { ai, IMAGE_MODEL } from '@/ai/genkit';

const GenerateBaseImageInputSchema = z.object({
  prompt: z.string().describe('Image generation prompt'),
});

export async function generateBaseImage(input: z.infer<typeof GenerateBaseImageInputSchema>): Promise<{ generatedImage: string }> {
  const { media } = await ai.generate({
    model: IMAGE_MODEL,
    config: { responseModalities: ['IMAGE'] },
    prompt: 'Hyper-realistic, 4K studio photograph of: ' + input.prompt,
  });
  if (!media?.url) throw new Error('Model failed to return an image.');
  return { generatedImage: media.url };
}

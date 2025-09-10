
'use server';

/**
 * @fileOverview AI flow for removing the background from an image.
 *
 * - `removeBackground` - The main function to trigger the background removal flow.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'genkit';

const ai = genkit({
  plugins: [googleAI({ apiKey: false })],
  model: 'googleai/gemini-2.5-flash',
});

const RemoveBackgroundInputSchema = z.object({
  baseImage: z
    .string()
    .describe(
      "The base image to edit, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});

const RemoveBackgroundOutputSchema = z.object({
  imageWithBgRemoved: z.string().describe('The image with the background removed as a data URI.'),
});

type RemoveBackgroundInput = z.infer<typeof RemoveBackgroundInputSchema>;
type RemoveBackgroundOutput = z.infer<typeof RemoveBackgroundOutputSchema>;

export async function removeBackground(
  apiKey: string,
  input: RemoveBackgroundInput
): Promise<RemoveBackgroundOutput> {
  return removeBackgroundFlow(input, { context: { apiKey } });
}

const removeBackgroundPrompt = ai.definePrompt({
  name: 'removeBackgroundPrompt',
  model: 'googleai/gemini-2.5-flash-image-preview',
  config: { responseModalities: ['TEXT', 'IMAGE'] },
  input: { schema: RemoveBackgroundInputSchema },
  prompt: `You are an expert image editor. Your task is to remove the background from the provided image, leaving only the main subject. The new background must be transparent.

Image: {{media url=baseImage}}
`,
});

const removeBackgroundFlow = ai.defineFlow(
  {
    name: 'removeBackgroundFlow',
    inputSchema: RemoveBackgroundInputSchema,
    outputSchema: RemoveBackgroundOutputSchema,
  },
  async (input, { context }) => {
    if (!context?.apiKey) throw new Error('Must supply an API key.');
    
    const { media } = await removeBackgroundPrompt(input, { config: { apiKey: context.apiKey } });

    if (!media?.url) {
        throw new Error('The AI model did not return an image.');
    }

    return { imageWithBgRemoved: media.url };
  }
);

// The directive tells the Next.js runtime that this code should only be executed on the server side.
'use server';

/**
 * @fileOverview AI flow for generating a base image from a text prompt.
 *
 * - `generateBaseImage` - The main function to trigger the image generation flow.
 * - `GenerateBaseImageInput` - Input type for the `generateBaseImage` function.
 * - `GenerateBaseImageOutput` - Output type for the `generateBaseImage` function.
 */

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {z} from 'genkit';

const ai = genkit({
  plugins: [googleAI({apiKey: false})],
  model: 'googleai/gemini-3-pro-image-preview',
});


// Define schemas for the input and output data
const GenerateBaseImageInputSchema = z.object({
    prompt: z.string().describe('The text prompt to generate an image from.'),
});

const GenerateBaseImageOutputSchema = z.object({
  generatedImage: z.string().describe('The generated image as a data URI.'),
});

export type GenerateBaseImageInput = z.infer<typeof GenerateBaseImageInputSchema>;
export type GenerateBaseImageOutput = z.infer<typeof GenerateBaseImageOutputSchema>;

// Exported function to trigger the flow
export async function generateBaseImage(apiKey: string, input: GenerateBaseImageInput): Promise<GenerateBaseImageOutput> {
  return generateBaseImageFlow(input, {context: {apiKey}});
}

// Define the flow
const generateBaseImageFlow = ai.defineFlow(
  {
    name: 'generateBaseImageFlow',
    inputSchema: GenerateBaseImageInputSchema,
    outputSchema: GenerateBaseImageOutputSchema,
  },
  async (input, {context}) => {
    if (!context?.apiKey) throw new Error("Must supply an API key.");

    const { media } = await ai.generate({
        model: 'googleai/gemini-3-pro-image-preview',
        config: {responseModalities: ['TEXT', 'IMAGE'], apiKey: context.apiKey},
        prompt: input.prompt,
    });

    if (!media?.url) {
        throw new Error('The AI model did not return an image.');
    }

    return {generatedImage: media.url};
  }
);

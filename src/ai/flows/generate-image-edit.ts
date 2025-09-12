
// The directive tells the Next.js runtime that this code should only be executed on the server side.
'use server';

/**
 * @fileOverview AI flow for editing images based on a base image, an annotated image, and element images.
 *
 * - `generateImageEdit` - The main function to trigger the image editing flow.
 * - `GenerateImageEditInput` - Input type for the `generateImageEdit` function (currently unused but defined for clarity).
 * - `GenerateImageEditOutput` - Output type for the `generateImageEdit` function.
 */

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {z} from 'genkit';

const ai = genkit({
  plugins: [googleAI({apiKey: false})],
  model: 'googleai/gemini-2.5-flash',
});


// Define schemas for the input and output data
const GenerateImageEditInputSchema = z.object({
  baseImage: z
    .string()
    .describe(
      "The base image to edit, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  annotatedImage: z
    .string()
    .optional()
    .describe(
      "The annotated image (base image with highlights and text), as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  elementImages: z
    .array(z.object({name: z.string(), url: z.string()}))
    .max(3)
    .optional()
    .describe(
      "up to three 'element' images that might be incorporated into the edit"
    ),
  customPrompt: z.string().optional().describe('Optional custom prompt to influence the image editing process.'),
  actionPrompt: z.string().optional().describe('An optional prompt to change the pose of the subject in the image.'),
  backgroundPrompt: z.string().optional().describe('An optional prompt to change the background of the image.'),
});

const GenerateImageEditOutputSchema = z.object({
  editedImage: z.string().describe('The edited image as a data URI.'),
});

export type GenerateImageEditInput = z.infer<typeof GenerateImageEditInputSchema>;
export type GenerateImageEditOutput = z.infer<typeof GenerateImageEditOutputSchema>;

// Exported function to trigger the flow
export async function generateImageEdit(apiKey: string, input: GenerateImageEditInput): Promise<GenerateImageEditOutput> {
  return generateImageEditFlow(input, {context: {apiKey}});
}

// Define the prompt
const imageEditPrompt = ai.definePrompt({
  name: 'imageEditPrompt',
  model: 'googleai/gemini-2.5-flash-image-preview',
  config: {responseModalities: ['TEXT', 'IMAGE']},
  input: {schema: GenerateImageEditInputSchema},
  prompt: `You are an AI image editor. You will take a base image, and edit it based on an annotated version of the image which includes highlights and text. You may also be provided with element images. You will always return a data URL representing the final edited image.

  Try to keep photorealistic scene consistency - when adding or changing parts of the picture, always match the lighting and make it look seamless and photorealistic.

Base Image: {{media url=baseImage}}
{{#if actionPrompt}}
=== Action Prompt
{{{actionPrompt}}}

Based on the action prompt, you will modify the pose of the subject in the base image.
{{/if}}

{{#if backgroundPrompt}}
=== Background Prompt
{{{backgroundPrompt}}}

Based on the background prompt, you will modify the background of the base image.
{{/if}}

{{#if annotatedImage}}
=== Annotations

The user has provided annotations to the image using simple highlighter and text tools. These annotations may circle, highlight, or otherwise mark edits for the original image. DO NOT keep any of the annotations directly, but use them to guide your final output.

Annotated Image: {{media url=annotatedImage}}
{{/if}}

{{#if elementImages.length}}
=== Element Images

The user has provided additional "element" images that might be referenced in the prompt or annotations.
{{#each elementImages}}
{{{this.name}}}: {{media url=this.url}}
{{/each}}
{{/if}}

{{#if customPrompt}}
=== Custom Prompt

The user has provided an additional custom prompt to guide the image edit:

{{{customPrompt}}}
{{else}}
{{#if elementImages.length}}
=== Task
Incorporate the element images into the base image in a creative and seamless way.
{{/if}}
{{/if}}

Please combine all of the above instructions (Action, Annotations, Elements, and Custom Prompt) into a single, cohesive, final image.
`,
});

// Define the flow
const generateImageEditFlow = ai.defineFlow(
  {
    name: 'generateImageEditFlow',
    inputSchema: GenerateImageEditInputSchema,
    outputSchema: GenerateImageEditOutputSchema,
  },
  async (input, {context}) => {
    if (!context?.apiKey) throw new Error("Must supply an API key.");

    if (!input.annotatedImage && !input.customPrompt && (!input.elementImages || input.elementImages.length === 0) && !input.actionPrompt && !input.backgroundPrompt) {
      throw new Error('Please provide an annotated image, a custom prompt, a background prompt, an action prompt, or at least one element image.');
    }
    
    const {media} = await imageEditPrompt(input, {config: {apiKey: context.apiKey}});

    return {editedImage: media?.url || ''};
  }
);

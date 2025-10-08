
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

const ImagePayloadSchema = z.object({
  url: z.string(),
  contentType: z.string(),
});

// Define schemas for the input and output data
const GenerateImageEditInputSchema = z.object({
  baseImage: z
    .string()
    .describe(
      "The base image to edit, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'. This may also be referred to as 'Original Image'."
    ),
  annotatedImage: z
    .string()
    .optional()
    .describe(
      "The annotated image (base image with highlights and text), as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  elementImages: z
    .array(z.object({name: z.string(), url: z.string(), contentType: z.string()}))
    .max(3)
    .optional()
    .describe(
      "up to three 'element' images that might be incorporated into the edit"
    ),
  customPrompt: z.string().optional().describe('Optional custom prompt to influence the image editing process.'),
  actionPrompt: z.string().optional().describe('An optional prompt to change the pose of the subject in the image.'),
  backgroundPrompt: z.string().optional().describe('An optional prompt to change the background of the image.'),
  backgroundImageUrl: ImagePayloadSchema.optional().describe("An image to use as the new background."),
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
  prompt: `You are an expert AI image editor. Your primary task is to seamlessly blend a subject from an original photo into a new context, following various instructions.

You will always return a data URL representing the final edited image.
Your final output MUST contain the subject from the 'Base Image for Editing', modified and placed according to the instructions.

=== Base Image for Editing
This is the primary image to be edited.
{{media url=baseImage}}

=== Custom Prompt
{{#if customPrompt}}
    {{{customPrompt}}}
    If the custom prompt contains "Swap the face", you MUST use the 'prompt-image' element image as the new body.
    For helmeted figures, you MUST make the helmet's visor transparent or retracted, revealing the face from the 'Base Image for Editing' inside. The final image should look as if the person is actually wearing the helmet, not like a photo sticker.
    You MUST match the head orientation, angle, and position to the new body to make it look natural.
    If an element image named 'prompt-image' exists, you MUST use that image to perform the edit described in this custom prompt.
    For prompts like changing clothes, you MUST keep the person from the 'Base Image for Editing' and apply the clothing from 'prompt-image'.
{{/if}}

Try to keep photorealistic scene consistency - when adding or changing parts of the picture, always match the lighting and make it look seamless and photorealistic.

=== Action
{{#if actionPrompt}}
{{actionPrompt}}
{{/if}}

=== Background
{{#if backgroundImageUrl}}
You MUST replace the background of the 'Base Image for Editing' with this new background. Make it look realistic and natural, and blend the subject from the 'Base Image for Editing' into the new background.
New Background Image: {{media url=backgroundImageUrl.url}}
{{else if backgroundPrompt}}
{{{backgroundPrompt}}}
{{/if}}

=== Annotations
{{#if annotatedImage}}
The user has provided annotations on the image. Use them as a guide for your edits, but DO NOT include the annotations (highlights, drawn text) in the final output.
Annotated Image: {{media url=annotatedImage}}
{{/if}}

=== Element Images
{{#if elementImages.length}}
The user has provided additional "element" images.
{{#each elementImages}}
    {{{this.name}}}: {{media url=this.url}}
{{/each}}
{{/if}}

=== Final Instruction
Combine all of the above instructions into a single, cohesive, final image.
Your final output MUST contain the subject from the 'Base Image for Editing', modified and placed according to the instructions.
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






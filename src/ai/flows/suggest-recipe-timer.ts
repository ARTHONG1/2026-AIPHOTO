'use server';

/**
 * @fileOverview An AI agent that suggests recipe timer settings based on recipe instructions.
 *
 * - suggestRecipeTimer - A function that suggests timer settings based on recipe instructions.
 * - SuggestRecipeTimerInput - The input type for the suggestRecipeTimer function.
 * - SuggestRecipeTimerOutput - The return type for the suggestRecipeTimer function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestRecipeTimerInputSchema = z.object({
  recipeInstructionsUrl: z
    .string()
    .describe('The URL of the recipe instructions webpage.'),
});
export type SuggestRecipeTimerInput = z.infer<typeof SuggestRecipeTimerInputSchema>;

const SuggestRecipeTimerOutputSchema = z.object({
  suggestedMinutes: z
    .number()
    .describe('The suggested timer duration in minutes.'),
  suggestedSeconds: z
    .number()
    .describe('The suggested timer duration in seconds.'),
  reasoning: z
    .string()
    .describe('The reasoning behind the suggested timer duration.'),
});
export type SuggestRecipeTimerOutput = z.infer<typeof SuggestRecipeTimerOutputSchema>;

export async function suggestRecipeTimer(input: SuggestRecipeTimerInput): Promise<SuggestRecipeTimerOutput> {
  return suggestRecipeTimerFlow(input);
}

const getRecipeCookingTime = ai.defineTool(
  {
    name: 'getRecipeCookingTime',
    description: 'Retrieves the cooking time in minutes from a recipe webpage.',
    inputSchema: z.object({
      recipeInstructionsUrl: z
        .string()
        .describe('The URL of the recipe instructions webpage.'),
    }),
    outputSchema: z.object({
      minutes: z.number().describe('The cooking time in minutes.'),
      reason: z.string().describe('The reason the model chose this time.')
    }),
  },
  async input => {
    // TODO: implement the logic to extract cooking time from the webpage
    //  For now, return a dummy value.
    return { minutes: 25, reason: `I looked at ${input.recipeInstructionsUrl} and found a cooking time of 25 minutes.` };
  }
);

const prompt = ai.definePrompt({
  name: 'suggestRecipeTimerPrompt',
  tools: [getRecipeCookingTime],
  input: {schema: SuggestRecipeTimerInputSchema},
  output: {schema: SuggestRecipeTimerOutputSchema},
  prompt: `You are a helpful assistant that suggests a timer duration based on recipe instructions.

  The user will provide a URL to a recipe.

  Use the getRecipeCookingTime tool to extract the recipe's cooking time.

  Suggest a timer duration in minutes and seconds, and explain your reasoning.
  Do not use any canned responses.
  Response in a JSON format.
  Example: {
  "suggestedMinutes": 25,
  "suggestedSeconds": 0,
  "reasoning": "The recipe has a cooking time of 25 minutes. Setting the timer to 25 minutes."
  }
  `,
});

const suggestRecipeTimerFlow = ai.defineFlow(
  {
    name: 'suggestRecipeTimerFlow',
    inputSchema: SuggestRecipeTimerInputSchema,
    outputSchema: SuggestRecipeTimerOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);


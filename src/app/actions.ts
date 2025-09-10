'use server';

import { suggestRecipeTimer, type SuggestRecipeTimerOutput } from '@/ai/flows/suggest-recipe-timer';
import { z } from 'zod';

const urlSchema = z.string().url();

type SuggestionState = {
  data?: SuggestRecipeTimerOutput;
  error?: string;
}

export async function getTimerSuggestion(url: string): Promise<SuggestionState> {
  const validation = urlSchema.safeParse(url);
  if (!validation.success) {
    return { error: 'Please enter a valid URL.' };
  }

  try {
    const suggestion = await suggestRecipeTimer({ recipeInstructionsUrl: url });
    return { data: suggestion };
  } catch (e) {
    console.error(e);
    return { error: 'Failed to get suggestion. Please try again.' };
  }
}

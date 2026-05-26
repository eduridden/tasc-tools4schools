/**
 * @fileOverview An AI flow to suggest a relevant icon for a given term.
 */

import { ai } from '../genkit';
import { SuggestIconInputSchema, SuggestIconOutputSchema } from '../schemas';

const suggestIconPrompt = ai.definePrompt({
  name: 'suggestIconPrompt',
  input: { schema: SuggestIconInputSchema },
  output: { schema: SuggestIconOutputSchema },
  prompt: `You are a UI/UX design expert specialising in icon-based navigation.
Your task is to select the most semantically relevant icon for a given term from a list of available icons.

Analyse the term "{{term}}" and choose the best icon from the following list that represents its meaning.
Prioritise icons that are clear, common, and easily recognisable.

Available Icons: {{{json iconList}}}`,
});

export const suggestIconFlow = ai.defineFlow(
  {
    name: 'suggestIconFlow',
    inputSchema: SuggestIconInputSchema,
    outputSchema: SuggestIconOutputSchema,
  },
  async (input) => {
    const { output } = await suggestIconPrompt(input);
    if (!output) {
      throw new Error('The AI model did not return a valid output.');
    }
    return output;
  }
);

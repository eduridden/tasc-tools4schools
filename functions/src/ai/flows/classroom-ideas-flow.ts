/**
 * @fileOverview An AI flow to generate classroom activity ideas for a given tool.
 */

import { ai } from '../genkit';
import { ClassroomIdeasInputSchema, ClassroomIdeasOutputSchema } from '../schemas';

const classroomIdeasPrompt = ai.definePrompt({
  name: 'classroomIdeasPrompt',
  input: { schema: ClassroomIdeasInputSchema },
  output: { schema: ClassroomIdeasOutputSchema },
  prompt: `You are an expert, creative, and innovative K-12 teacher.
Your task is to generate practical and engaging classroom activity ideas for a specific AI tool.

Tool Name: "{{toolName}}"
Tool Description: "{{toolDescription}}"
Tool Categories: {{{json categoryNames}}}
Relevant Subject Areas: {{{json subjectNames}}}

Based on this information, generate three distinct and practical ideas for how this tool could be used in a classroom.
- The ideas should be suitable for the subject areas provided.
- The tone should be encouraging and inspiring for a fellow educator.
- Each idea should be a concise, actionable concept.`,
});

export const generateClassroomIdeasFlow = ai.defineFlow(
  {
    name: 'generateClassroomIdeasFlow',
    inputSchema: ClassroomIdeasInputSchema,
    outputSchema: ClassroomIdeasOutputSchema,
  },
  async (input) => {
    const { output } = await classroomIdeasPrompt(input);
    if (!output) {
      throw new Error('The AI model did not return a valid output.');
    }
    return output;
  }
);

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Initialize Genkit with Google AI plugin
// Using gemini-2.5-flash-lite for fast, cost-efficient classroom idea generation
export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GEMINI_API_KEY,
    }),
  ],
  model: googleAI.model('gemini-2.5-flash-lite'),
});

// Export the googleAI reference for model-specific configurations
export { googleAI };

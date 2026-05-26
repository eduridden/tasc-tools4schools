
import { z } from 'zod';

const FilterOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const SearchQueryInputSchema = z.object({
  query: z.string().describe("The user's natural language search query."),
  availableCategories: z.array(FilterOptionSchema).describe('List of available tool categories with their IDs and names.'),
  availableAudiences: z.array(FilterOptionSchema).describe('List of available target audiences with their IDs and names.'),
  availableCostModels: z.array(z.string()).describe('List of available cost models (e.g., Free, Freemium, Subscription).'),
});
export type SearchQueryInput = z.infer<typeof SearchQueryInputSchema>;

export const SearchQueryOutputSchema = z.object({
  categoryId: z.string().optional().describe("The ID of the most relevant tool category identified from the query. Should match one of the provided availableCategories."),
  audienceId: z.string().optional().describe("The ID of the most relevant target audience identified from the query. Should match one of the provided availableAudiences."),
  costModel: z.string().optional().describe("The cost model identified from the query (e.g., 'Free', 'Freemium'). Should match one of the provided availableCostModels."),
  keywords: z.string().optional().describe('Any remaining keywords from the query after extracting structured filters. This should be used for a fallback text search.'),
});
export type SearchQueryOutput = z.infer<typeof SearchQueryOutputSchema>;


export const SuggestIconInputSchema = z.object({
  term: z.string().describe("The term or phrase to find an icon for."),
  iconList: z.array(z.string()).describe("The list of available icon names to choose from."),
});
export type SuggestIconInput = z.infer<typeof SuggestIconInputSchema>;

export const SuggestIconOutputSchema = z.object({
  iconName: z.string().describe("The name of the most relevant icon from the provided list."),
});
export type SuggestIconOutput = z.infer<typeof SuggestIconOutputSchema>;

// Schema for the full AI search flow
const AiToolForSearchSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  categoryNames: z.array(z.string()),
  keyFeatures: z.array(z.string()).optional(),
  gdprCompliant: z.enum(['Yes', 'No', 'Unknown']).optional(),
  coppaCompliant: z.enum(['Yes', 'No', 'Unknown']).optional(),
  ferpaCompliant: z.enum(['Yes', 'No', 'Unknown']).optional(),
  dataHostingLocation: z.string().optional(),
  st4sVerified: z.enum(['Yes', 'No', 'Unknown']).optional(),
  costModel: z.string().optional(),
  ageRestriction: z.string().optional(),
});

export const AiSearchInputSchema = z.object({
  query: z.string().describe("The user's natural language search query."),
  tools: z.array(AiToolForSearchSchema).describe("The full list of AI tools available to search through."),
});
export type AiSearchInput = z.infer<typeof AiSearchInputSchema>;

export const AiSearchOutputSchema = z.object({
  rankedToolIds: z.array(z.string()).describe("An ordered list of tool IDs, ranked from most to least relevant based on the user's query."),
});
export type AiSearchOutput = z.infer<typeof AiSearchOutputSchema>;


// Schema for Classroom Ideas flow
export const ClassroomIdeasInputSchema = z.object({
  toolName: z.string(),
  toolDescription: z.string(),
  categoryNames: z.array(z.string()),
  subjectNames: z.array(z.string()),
});
export type ClassroomIdeasInput = z.infer<typeof ClassroomIdeasInputSchema>;

export const ClassroomIdeasOutputSchema = z.object({
  ideas: z.array(z.string()).describe("An array of three distinct classroom activity ideas."),
});
export type ClassroomIdeasOutput = z.infer<typeof ClassroomIdeasOutputSchema>;


// Schema for the new Generate Tool Guide flow
export const GenerateToolGuideInputSchema = z.object({
  toolName: z.string().describe("The name of the AI tool."),
  toolDescription: z.string().describe("The description of the AI tool."),
  toolUrl: z.string().describe("The URL of the AI tool's website."),
  learningArea: z.string().describe("The specific learning area to generate ideas for."),
  isDataUnsafe: z.boolean().describe("A flag indicating if the tool has unsafe data practices."),
});
export type GenerateToolGuideInput = z.infer<typeof GenerateToolGuideInputSchema>;

export const GenerateToolGuideOutputSchema = z.object({
  ideas: z.array(z.string()).describe("An array of three distinct, practical ideas for the specified learning area."),
});
export type GenerateToolGuideOutput = z.infer<typeof GenerateToolGuideOutputSchema>;


// Schema for the new AI Vetting flow
export const VetToolInputSchema = z.object({
  toolName: z.string().describe("The name of the tool to vet."),
  toolUrl: z.string().describe("The primary URL of the tool's website."),
});
export type VetToolInput = z.infer<typeof VetToolInputSchema>;

const ComplianceStatus = z.enum(["Yes", "No", "Unknown"]);

export const VetToolOutputSchema = z.object({
  description: z.string().describe("A concise, well-written description of the tool's primary use case in an educational setting."),
  ageRestriction: z.enum(["All Ages", "13+", "16+", "18+"]).describe("The minimum age requirement specified in the tool's terms or privacy policy."),
  costModel: z.enum(["Free", "Freemium", "Subscription"]).optional().describe("The pricing model: 'Free' if always free, 'Freemium' if a free tier exists alongside paid plans, 'Subscription' if payment is required to use the tool."),
  documentationUrl: z.string().url().optional().describe("The direct URL to the tool's official help, support, docs, or FAQ page."),
  trainingUrl: z.string().url().optional().describe("The direct URL to any official training, certification, tutorial library, or educator academy provided by the tool's company."),
  unsafeDataPractices: z.boolean().describe("True if the tool's privacy policy mentions using user data for training models or sharing it publicly, otherwise false."),
  vettingNotes: z.string().describe("A summary for administrators covering data retention, security compliance (like COPPA/FERPA), and any other relevant privacy or safety concerns. Formatted as markdown bullet points using '*'."),
  keyFeatures: z.array(z.string()).optional().describe("A list of 6–10 short, specific key features or capabilities of the tool, each under 8 words. Focus on features relevant to educators and students."),
  gdprCompliant: ComplianceStatus.optional().describe("Whether the tool explicitly claims GDPR compliance in its privacy policy or documentation. 'Yes', 'No', or 'Unknown' if not mentioned."),
  coppaCompliant: ComplianceStatus.optional().describe("Whether the tool explicitly claims COPPA compliance (U.S. Children's Online Privacy Protection Act). 'Yes', 'No', or 'Unknown' if not mentioned."),
  ferpaCompliant: ComplianceStatus.optional().describe("Whether the tool explicitly claims FERPA compliance (U.S. Family Educational Rights and Privacy Act). 'Yes', 'No', or 'Unknown' if not mentioned."),
  dataHostingLocation: z.string().optional().describe("The country or region where the tool's data is hosted (e.g. 'United States', 'European Union', 'Australia'). If multiple, list them comma-separated. Omit if unknown."),
  st4sVerified: ComplianceStatus.optional().describe("Whether the tool appears in the Safe Technology for Schools (ST4S) verified product list at st4s.edu.au. 'Yes' if found, 'No' if not found, 'Unknown' if the check could not be completed."),
});
export type VetToolOutput = z.infer<typeof VetToolOutputSchema>;

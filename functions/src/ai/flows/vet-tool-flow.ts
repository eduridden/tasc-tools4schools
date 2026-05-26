/**
 * @fileOverview AI flow to research and vet a tool by analysing its website,
 * pricing page, privacy policy, terms of service, training resources, and
 * compliance certifications including ST4S verification.
 */

import { ai } from '../genkit';
import { VetToolInputSchema, VetToolOutputSchema } from '../schemas';
import { safeHeadFetch } from '../../lib/url-guard';

const vetToolPrompt = ai.definePrompt({
  name: 'vetToolPrompt',
  input: { schema: VetToolInputSchema },
  output: { schema: VetToolOutputSchema },
  prompt: `You are an expert Digital Safety Officer for a school district in NSW, Australia. Your task is to thoroughly research a new AI tool for potential educational use. You must visit the tool's website and actively search the web for legal documents, compliance certifications, and training resources. Use ONLY information from these sources — do not rely on prior memory about the tool.

Tool to Research:
- Name: "{{toolName}}"
- URL: "{{toolUrl}}"

Follow these steps in order:

1. **Analyse the Website:** Visit {{toolUrl}} to understand the tool's primary function and intended audience. Write a clear, concise 'description' of its main educational use case in 2–3 sentences.

2. **Extract Key Features:** Based on your visit to the website, identify 6–10 specific features or capabilities that are most relevant to educators and students. Each feature must be a short phrase under 8 words (e.g. "Lesson plan generator", "AI-powered rubric creation", "Student progress tracking"). Return these as the 'keyFeatures' array.

3. **Determine Cost Model:** Visit the pricing page (look for /pricing, /plans, or a Pricing link in the nav). Determine:
   - "Free" — the tool is entirely free with no paid tiers
   - "Freemium" — a free tier exists alongside paid plans
   - "Subscription" — payment is required to use the tool at all
   Return the appropriate costModel. If you cannot determine pricing with confidence, omit this field.

4. **Find and Analyse Legal Documents:** Perform a web search for the official "Privacy Policy" and "Terms of Service" for "{{toolName}}". Read both documents carefully.

5. **Determine Data Safety:** Based on the legal documents, determine if the company uses customer or student data to train its AI models, or shares data with third parties for purposes beyond core service delivery.
   - If yes → set unsafeDataPractices to true
   - If the policy is clear that data is NOT used for training → set unsafeDataPractices to false
   - If you cannot find the policies, or they are ambiguous → set unsafeDataPractices to true (safety precaution)

6. **Determine Age Restriction:** Find the minimum age requirement (commonly under "Eligibility" or "Use by Minors" in the Terms of Service). Return: "All Ages", "13+", "16+", or "18+".

7. **Check Compliance Certifications:** Search the website, privacy policy, and any security/compliance pages for explicit claims of:
   - **GDPR** (General Data Protection Regulation) — common for tools serving European users
   - **COPPA** (Children's Online Privacy Protection Act) — U.S. law for under-13 users
   - **FERPA** (Family Educational Rights and Privacy Act) — U.S. law for student education records
   For each, return "Yes" if explicitly claimed, "No" if explicitly excluded or denied, or "Unknown" if not mentioned. Do not assume compliance — only return "Yes" if the company explicitly states it.

8. **Determine Data Hosting Location:** Find where the company hosts or stores user data. Check the privacy policy for mentions of servers, data centres, hosting regions, or cloud providers (e.g. AWS us-east-1 = United States). Return the country or region as a short string (e.g. "United States", "European Union", "Australia", "United States, European Union"). Omit if genuinely unknown.

9. **Check ST4S Verification:** Visit https://st4s.edu.au/verify-a-badge/ and search for "{{toolName}}" in the Safe Technology for Schools verified product list. If the tool appears in the verified list, return st4sVerified as "Yes". If you can access the page and the tool is not listed, return "No". If the page is inaccessible or the check cannot be completed, return "Unknown".

10. **Find Documentation URL:** Search the website for a Help, Support, Docs, or FAQ page. Set documentationUrl to the direct URL. Omit if none found.

11. **Find Training URL:** Search for any official training programs, certification courses, educator academies, or tutorial libraries provided by the company. Set trainingUrl to the direct URL. Omit if none exists.

12. **Summarise Vetting Notes:** Write a summary for school administrators as 'vettingNotes'. Format it as a single string of markdown bullet points (using '*'). Cover:
   - **Data for Training:** State clearly whether user/student data is used for AI training and why you reached that conclusion.
   - **Data Retention & Security:** Summarise their stated data retention periods and security measures (e.g., encryption, SOC 2, ISO 27001).
   - **Compliance:** Note any compliance with COPPA, FERPA, GDPR, Privacy Act 1988 (Australia), or NSW Department of Education requirements.
   - **Age Limits:** Explain the basis for the age restriction you determined.
   - **Pricing:** Briefly describe what the free tier includes (if applicable) and what requires payment.
   - **ST4S Status:** Note whether the tool is verified on the Safe Technology for Schools register.`,
});

/**
 * Checks whether a URL is reachable AND points at a public host.
 *
 * The URL comes from model output (web-grounded) so it must be treated as
 * fully untrusted — we route it through the SSRF-safe HEAD fetch which
 * rejects private / link-local hosts and does NOT follow redirects.
 */
async function isUrlReachable(url: string | undefined): Promise<boolean> {
  if (!url) return false;
  const res = await safeHeadFetch(url, 3000);
  return !!res && res.ok;
}

export const vetToolFlow = ai.defineFlow(
  {
    name: 'vetToolFlow',
    inputSchema: VetToolInputSchema,
    outputSchema: VetToolOutputSchema,
  },
  async (input) => {
    const { output } = await vetToolPrompt(input);

    if (!output) {
      throw new Error('The AI model did not return a valid output.');
    }

    // Safety fallback: default to unsafe if the model returns null/undefined for this critical field.
    if (output.unsafeDataPractices === null || output.unsafeDataPractices === undefined) {
      output.unsafeDataPractices = true;
    }

    // Validate URLs are actually reachable before returning them.
    if (output.documentationUrl) {
      const reachable = await isUrlReachable(output.documentationUrl);
      if (!reachable) output.documentationUrl = undefined;
    }

    if (output.trainingUrl) {
      const reachable = await isUrlReachable(output.trainingUrl);
      if (!reachable) output.trainingUrl = undefined;
    }

    return output;
  }
);

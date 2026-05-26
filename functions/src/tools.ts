/**
 * Public tool submission callable.
 *
 * Hardening:
 *   - Auth required (no anonymous submissions). Identity comes from SAML
 *     SSO via Firebase Auth; the SAML IdP gates the entire caller set.
 *   - Strict zod schema rejects unknown keys — clients cannot smuggle
 *     `status`, `recommended`, `unsafeDataPractices`, or any other field
 *     that is admin-controlled.
 *   - Server overrides status/createdAt/updatedAt/submittedBy regardless
 *     of what the client sends.
 *   - Per-uid rate limit: 5 submissions per UTC day. Counter is held in
 *     `rate_limits/{uid}/daily/{YYYY-MM-DD}` (write-only to Admin SDK).
 *   - Error messages returned to the client are generic.
 */

import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import { isPublicUrlShape } from "./lib/url-guard";
import { consumeSubmissionQuota } from "./lib/rate-limit";

const ALLOWED_ORIGINS = [
  "https://tools4schools.tasc.nsw.edu.au",
  "http://localhost:5173",
  "http://localhost:4173",
];

const SubmitToolInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    url: z.string().trim().max(2048).refine(isPublicUrlShape, {
      message: "URL must be a public https URL",
    }),
    description: z.string().trim().max(2000).optional(),
    submitterNote: z.string().trim().max(2000).optional(),
    toolCategoryIds: z.array(z.string().min(1).max(64)).max(20).optional(),
    subjectAreaIds: z.array(z.string().min(1).max(64)).max(40).optional(),
    targetAudienceIds: z.array(z.string().min(1).max(64)).max(20).optional(),
    costModel: z.enum(["Free", "Freemium", "Subscription"]).optional(),
  })
  .strict(); // reject unknown keys

export const submitTool = onCall(
  {
    cors: ALLOWED_ORIGINS,
    concurrency: 10,
    maxInstances: 3,
    timeoutSeconds: 30,
  },
  async (request: CallableRequest<unknown>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign-in required to submit a tool.");
    }
    const uid = request.auth.uid;

    const parse = SubmitToolInputSchema.safeParse(request.data);
    if (!parse.success) {
      logger.warn("submitTool input rejected", {
        uid,
        issues: parse.error.issues.map((i) => ({
          path: i.path.join("."),
          code: i.code,
        })),
      });
      throw new HttpsError(
        "invalid-argument",
        "Submission did not match the expected schema.",
      );
    }
    const data = parse.data;

    try {
      await consumeSubmissionQuota(uid);
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      logger.error("submitTool rate limit transaction failed", { uid, err: String(err) });
      throw new HttpsError("internal", "Submission failed. Please try again.");
    }

    try {
      const db = getFirestore();
      // Server controls every administrative field. Client-supplied values
      // for `status`, `recommended`, `unsafeDataPractices`, `createdForTasc`,
      // `vettingNotes` are *not* in the schema and would have been rejected
      // above; this is defence in depth.
      await db.collection("ai_tools").add({
        name: data.name,
        url: data.url,
        description: data.description ?? "",
        submitterNote: data.submitterNote ?? "",
        toolCategoryIds: data.toolCategoryIds ?? [],
        subjectAreaIds: data.subjectAreaIds ?? [],
        targetAudienceIds: data.targetAudienceIds ?? [],
        costModel: data.costModel,
        status: "Pending",
        submittedBy: uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      logger.info("submitTool ok", { uid });
      return { success: true };
    } catch (err) {
      logger.error("submitTool write failed", {
        uid,
        err: err instanceof Error ? { name: err.name, message: err.message } : String(err),
      });
      throw new HttpsError("internal", "Submission failed. Please try again.");
    }
  },
);

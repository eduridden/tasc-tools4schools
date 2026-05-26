/**
 * Cloud Functions entry point.
 *
 * Hardening applied to every callable:
 *   - `if (!req.auth)` — anonymous calls are rejected. Auth identity comes
 *     from SAML SSO via Firebase Auth; the SAML IdP is the sole sign-in
 *     path (no public sign-up), which already bounds the caller set to
 *     known school identities. App Check is intentionally NOT enforced —
 *     reCAPTCHA Enterprise is unnecessary when SSO provides the same
 *     "is this caller authorised?" guarantee at a tighter trust boundary.
 *   - Strict zod parsing — unknown keys and malformed input are rejected
 *     before reaching any business logic.
 *   - Per-callable concurrency and maxInstances caps bound worst-case
 *     cost burn from a compromised user account.
 *   - Caller-facing error messages are generic; full error context is logged
 *     to Cloud Logging via structured fields only.
 *   - No request payloads are dumped to logs (use `uid` + short query hash).
 */

import * as admin from "firebase-admin";
import {
  onCall,
  HttpsError,
  type CallableRequest,
  type CallableOptions,
} from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { ZodSchema } from "zod";
import { createHash } from "node:crypto";

import { interpretQueryFlow } from "./ai/flows/search-query-flow";
import { suggestIconFlow } from "./ai/flows/suggest-icon-flow";
import { aiSearchFlow } from "./ai/flows/ai-search-flow";
import { generateClassroomIdeasFlow } from "./ai/flows/classroom-ideas-flow";
import { generateToolGuideFlow } from "./ai/flows/generate-tool-guide-flow";
import { vetToolFlow } from "./ai/flows/vet-tool-flow";
import {
  SearchQueryInputSchema,
  SuggestIconInputSchema,
  AiSearchInputSchema,
  ClassroomIdeasInputSchema,
  GenerateToolGuideInputSchema,
  VetToolInputSchema,
} from "./ai/schemas";
import { submitTool } from "./tools";
import { assertPublicUrlShape } from "./lib/url-guard";
import { consumeAiBudget, type AiCallWeight } from "./lib/rate-limit";

if (!admin.apps.length) {
  admin.initializeApp();
}

// Origins permitted in production. Localhost dev origins live in a separate
// env-gated list — they MUST NOT ship to production deployments.
const PROD_ALLOWED_ORIGINS = [
  "https://tools4schools.tasc.nsw.edu.au",
];
const DEV_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
];
const ALLOWED_ORIGINS =
  process.env.FUNCTIONS_EMULATOR === "true" ||
  process.env.NODE_ENV !== "production"
    ? [...PROD_ALLOWED_ORIGINS, ...DEV_ALLOWED_ORIGINS]
    : PROD_ALLOWED_ORIGINS;

// Standard options for every AI callable.
//   - Concurrency capped to slow runaway abuse.
//   - maxInstances caps the worst-case cost burn.
//   - GEMINI_API_KEY is sourced from Secret Manager at runtime.
//
// Typed as `CallableOptions` so the `secrets` array stays mutable, which
// is what `onCall` expects in firebase-functions v7.
const AI_OPTS: CallableOptions = {
  cors: ALLOWED_ORIGINS,
  secrets: ["GEMINI_API_KEY"],
  concurrency: 10,
  maxInstances: 5,
  timeoutSeconds: 60,
};

const NON_AI_OPTS: CallableOptions = {
  cors: ALLOWED_ORIGINS,
  concurrency: 20,
  maxInstances: 5,
  timeoutSeconds: 30,
};

export { submitTool };

/**
 * Short, non-reversible identifier for a query string, suitable for logging
 * without leaking PII (12 hex chars ≈ 48 bits of identity).
 */
function queryHash(input: unknown): string {
  return createHash("sha256")
    .update(typeof input === "string" ? input : JSON.stringify(input ?? ""))
    .digest("hex")
    .slice(0, 12);
}

/**
 * Auth + strict-schema gate. Every callable wraps its handler in this so the
 * checks cannot be forgotten on a new endpoint.
 *
 * If `aiWeight` is supplied, the call also consumes that many units from the
 * caller's daily AI budget (admins are exempt — see `consumeAiBudget`).
 */
async function withAuthAndSchema<TIn, TOut>(
  req: CallableRequest<unknown>,
  schema: ZodSchema<TIn>,
  handler: (input: TIn, uid: string) => Promise<TOut>,
  endpoint: string,
  aiWeight?: AiCallWeight,
): Promise<TOut> {
  if (!req.auth) {
    throw new HttpsError("unauthenticated", "Sign-in required.");
  }
  const parse = schema.safeParse(req.data);
  if (!parse.success) {
    logger.warn("callable input rejected", {
      endpoint,
      uid: req.auth.uid,
      issues: parse.error.issues.map(i => ({ path: i.path.join("."), code: i.code })),
    });
    throw new HttpsError("invalid-argument", "Request did not match the expected schema.");
  }
  if (aiWeight !== undefined) {
    await consumeAiBudget(req.auth.uid, aiWeight, req.auth.token.role === "admin");
  }
  try {
    return await handler(parse.data, req.auth.uid);
  } catch (err) {
    logger.error("callable handler failed", {
      endpoint,
      uid: req.auth.uid,
      err: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : String(err),
    });
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", "Request failed. Please try again.");
  }
}

export const interpretSearchQuery = onCall(AI_OPTS, async (req) =>
  withAuthAndSchema(req, SearchQueryInputSchema, async (data, uid) => {
    logger.info("interpretSearchQuery", { uid, queryHash: queryHash(data.query) });
    return interpretQueryFlow(data);
  }, "interpretSearchQuery", 1),
);

export const suggestIcon = onCall(AI_OPTS, async (req) =>
  withAuthAndSchema(req, SuggestIconInputSchema, async (data, uid) => {
    logger.info("suggestIcon", { uid, term: queryHash(data.term) });
    const result = await suggestIconFlow(data);
    return result.iconName;
  }, "suggestIcon", 1),
);

export const aiSearch = onCall(AI_OPTS, async (req) =>
  withAuthAndSchema(req, AiSearchInputSchema, async (data, uid) => {
    if (data.tools.length > 500) {
      throw new HttpsError("invalid-argument", "Too many tools in payload.");
    }
    logger.info("aiSearch", {
      uid,
      queryHash: queryHash(data.query),
      toolCount: data.tools.length,
    });
    return aiSearchFlow(data);
  }, "aiSearch", 2),
);

export const generateClassroomIdeas = onCall(AI_OPTS, async (req) =>
  withAuthAndSchema(req, ClassroomIdeasInputSchema, async (data, uid) => {
    logger.info("generateClassroomIdeas", { uid, toolHash: queryHash(data.toolName) });
    return generateClassroomIdeasFlow(data);
  }, "generateClassroomIdeas", 2),
);

export const generateToolGuide = onCall(AI_OPTS, async (req) =>
  withAuthAndSchema(req, GenerateToolGuideInputSchema, async (data, uid) => {
    // Tool URL must be a public https URL — model is asked to ground on it.
    try {
      assertPublicUrlShape(data.toolUrl);
    } catch {
      throw new HttpsError("invalid-argument", "Tool URL is not a valid public https URL.");
    }
    logger.info("generateToolGuide", {
      uid,
      toolHash: queryHash(data.toolName),
      learningArea: data.learningArea,
    });
    return generateToolGuideFlow(data);
  }, "generateToolGuide", 5),
);

export const vetTool = onCall(AI_OPTS, async (req) => {
  // Vetting is privileged — only admins may run it. Check before the
  // budget gate so non-admins are rejected with a clear permission error
  // rather than the generic budget message.
  if (req.auth?.token.role !== "admin") {
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "Sign-in required.");
    }
    throw new HttpsError("permission-denied", "Admin role required to run vetting.");
  }
  return withAuthAndSchema(req, VetToolInputSchema, async (data, uid) => {
    try {
      assertPublicUrlShape(data.toolUrl);
    } catch {
      throw new HttpsError("invalid-argument", "Tool URL is not a valid public https URL.");
    }
    logger.info("vetTool", { uid, toolHash: queryHash(data.toolName) });
    return vetToolFlow(data);
  }, "vetTool", 5);
});

export const findLogo = onCall(NON_AI_OPTS, async (req) =>
  withAuthAndSchema(
    req,
    VetToolInputSchema.pick({ toolUrl: true }),
    async (data, uid) => {
      let parsed: URL;
      try {
        parsed = assertPublicUrlShape(data.toolUrl);
      } catch {
        throw new HttpsError("invalid-argument", "Tool URL is not a valid public https URL.");
      }
      logger.info("findLogo", { uid, host: parsed.hostname });
      const { findBestLogo } = await import("./lib/logo-finder");
      return findBestLogo(parsed.toString());
    },
    "findLogo",
    1,
  ),
);

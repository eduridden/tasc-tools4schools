/**
 * Per-uid daily rate-limit / budget primitives.
 *
 * Two related shapes:
 *   - `consumeSubmissionQuota(uid)` — hard cap of 5 tool submissions per
 *     UTC day per user. Used by `submitTool`.
 *   - `consumeAiBudget(uid, weight)` — weighted budget shared across every
 *     AI callable. Lighter calls (icon suggestion, query parsing) cost 1
 *     unit; medium calls (semantic search, classroom ideas) cost 2; heavy
 *     calls (full vetting, tool guide) cost 5. Daily cap is 200 units —
 *     enough for normal teacher use, low enough to make sustained abuse
 *     economically visible. Admins are exempt so that vetting runs do
 *     not eat into an admin's own everyday budget.
 *
 * Counters live in Firestore at `rate_limits/{uid}/{kind}/{YYYY-MM-DD}`.
 * Reads/writes go through `db.runTransaction` so concurrent calls cannot
 * race past the cap. Firestore rules block client reads/writes on the
 * `rate_limits` collection except for the owner's own kind=='daily'
 * subcollection (debug only — see firestore.rules).
 */

import { HttpsError } from "firebase-functions/v2/https";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const SUBMISSION_DAILY_LIMIT = 5;
const AI_DAILY_BUDGET_UNITS = 200;

export type AiCallWeight = 1 | 2 | 5;

function isoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function tryConsume(
  uid: string,
  kind: "daily" | "ai",
  cap: number,
  cost: number,
  message: string,
): Promise<void> {
  const db = getFirestore();
  const ref = db
    .collection("rate_limits")
    .doc(uid)
    .collection(kind)
    .doc(isoDate());
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? (snap.data()?.count as number | undefined) ?? 0 : 0;
    if (current + cost > cap) {
      throw new HttpsError("resource-exhausted", message);
    }
    tx.set(
      ref,
      { count: FieldValue.increment(cost), updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  });
}

export async function consumeSubmissionQuota(uid: string): Promise<void> {
  return tryConsume(
    uid,
    "daily",
    SUBMISSION_DAILY_LIMIT,
    1,
    "Daily submission limit reached. Please try again tomorrow.",
  );
}

export async function consumeAiBudget(
  uid: string,
  weight: AiCallWeight,
  isAdmin: boolean,
): Promise<void> {
  // Admins are exempt — moderation/vetting workflows would otherwise
  // exhaust their own budget within a single review session.
  if (isAdmin) return;
  return tryConsume(
    uid,
    "ai",
    AI_DAILY_BUDGET_UNITS,
    weight,
    "Daily AI usage limit reached. Please try again tomorrow.",
  );
}

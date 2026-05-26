# Security waivers

This file documents npm advisories and accepted-risk decisions that remain
after the security remediation pass. Review and re-evaluate every item at
each dependency upgrade cycle.

Date: 2026-05-26
Reviewer: Code-Red Security Remediation

---

## Auth trust model — App Check intentionally NOT enforced

**Decision:** `enforceAppCheck` is intentionally omitted on every callable in
`functions/src/index.ts` and `functions/src/tools.ts`. reCAPTCHA Enterprise
is also not used.

**Why this is safe in this codebase:**

- The application uses **SAML SSO** as the sole sign-in path. There is no
  public sign-up surface — a user cannot create an account from the
  internet without going through TASC's SAML IdP.
- Every callable enforces `if (!req.auth)` before doing any work, so every
  request is bound to a SAML-authenticated identity.
- `submitTool` adds a per-uid daily rate limit (5/day), enforced via a
  Firestore transaction.
- `vetTool` additionally requires the `admin` custom claim.
- Per-function `concurrency` and `maxInstances` caps bound the worst-case
  cost burn from any single compromised user account.

App Check exists to answer "is the request coming from my official app?".
With SAML SSO + no sign-up, identity is already provably bound to a known
school user. Adding App Check on top of that would protect against a single
extra threat: an authorised SAML user scripting against the callables from
outside the official frontend. The accepted residual risk is that an
authorised user could abuse the AI endpoints — bounded by the rate limit,
admin-claim gate, and instance caps above.

If the threat model ever changes (public sign-up enabled, the app embeds
third-party content, etc.), enabling App Check is a small change:
re-add `enforceAppCheck: true` to the option objects and register a
reCAPTCHA Enterprise site key in Firebase Console.

---

## Root project (`/`)

**Status: 0 advisories at any severity.** `npm audit --production` returns
clean as of the dep upgrade. No waivers required.

---

## Functions (`/functions`)

**Status:** 24 advisories (17 moderate, 7 high) remain.

All remaining advisories sit in the transitive dependency tree of
`@genkit-ai/google-genai` → `genkit` → `@google-cloud/*` → `teeny-request`
→ `uuid` / `retry-request`. Specifically:

- `uuid` (older transitive copies) — moderate, info-disclosure / weak RNG
- `retry-request` — high, ReDoS via header parsing
- `teeny-request` — high, vulnerable HTTP redirect handling
- `@google-cloud/common@0.32.1–5.0.2` — moderate, transitive uuid + retry-request

### Why these are waived (not fixed today)

1. **No direct fix available.** `npm audit fix` cannot resolve them because
   the vulnerable versions are pinned by Google's official packages
   (`@google-cloud/storage`, `@google-cloud/firestore`, etc.) which
   `@genkit-ai/google-genai` requires. A breaking-change `npm audit fix
   --force` would downgrade Genkit and break every AI flow.
2. **Reachability is low.** The vulnerable code paths sit behind
   `firebase-admin` and Genkit's own HTTP client. In our codebase:
   - Every Cloud Function callable is gated by **SAML-bound auth check +
     strict zod validation** before any input reaches these libraries.
   - Every outbound `fetch` from our own code goes through the
     `functions/src/lib/url-guard.ts` helper which rejects private /
     link-local / loopback hosts. Genkit's outbound calls go to
     `generativelanguage.googleapis.com` only (controlled by us via the
     `secrets: ['GEMINI_API_KEY']` config) — the host is not
     attacker-influenced.
   - No external HTTP redirects are followed from caller-supplied URLs
     (we use `redirect: 'manual'`).
3. **Upstream fix is the right channel.** Google rotates these underlying
   transitive deps in their own release cycle; the next Genkit / Firebase
   Admin minor release typically picks up the fixes.

### Re-evaluation cadence

- Re-run `npm audit --production` weekly in CI; alert on any **new**
  CRITICAL advisory.
- Run `npm outdated` and `npm update` on `@genkit-ai/*` and
  `firebase-admin` monthly. After each update, re-run audit and remove
  this waiver section if the count reaches zero.

### Action items

- [ ] Add `npm audit --production --audit-level=critical` to CI as a
      hard gate (so any **new** critical regression breaks the build).
- [ ] Subscribe to GitHub security advisories for `@genkit-ai/*` and
      `@google-cloud/*` so we hear about upstream fixes.

---

## Hosting headers — accepted compromises in CSP

The Firebase Hosting `Content-Security-Policy` in `firebase.json` allows:

- `'unsafe-inline'` on `script-src` — required by Vite's
  preload directive injection and by Radix UI's inline event handlers.
  Mitigation: revisit when Vite emits hashed inline preloads (planned).
- `'unsafe-inline'` on `style-src` — required by Radix UI / DaisyUI
  inline `style` attributes (`element.style.transform = …` for
  animations and Radix positioning).

These two `'unsafe-inline'`s are tracked as known gaps. Tighten in a
future iteration when the underlying libraries support nonce/hash mode.

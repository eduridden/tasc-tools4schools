# Threat model — TASC Tools4Schools

Last reviewed: 2026-05-26

This document captures the trust boundaries, data classifications, and
top-tier abuse cases for the Tools4Schools application. Re-evaluate
whenever any of these change:

- A new external integration is added (any new outbound HTTP target).
- A new sign-in path is added.
- The user base expands beyond TASC SAML-authenticated identities.
- A new field is added to the user document or AI flow output that
  influences a moderation decision.

---

## Data classifications

| Class | Examples | Storage | Notes |
|---|---|---|---|
| Public | Tool listings (after admin approval), tool categories, subject areas, reviews | Firestore `ai_tools/*`, `tool_categories/*`, etc. — public read | Reviews are public; users post under a SAML-bound identity. |
| Identified | User profile (email, displayName, avatarUrl, bio) | Firestore `users/{uid}` — signed-in users read | Self-service writeable to a whitelisted field set. Identity itself is bound by SAML. |
| Operator-only | AI vetting notes draft, pending submissions | Firestore `ai_tools/{id}` with `status: 'Pending'` | Read public (status surfaced in UI). Vetting fields are *advisory* — see Trust boundary 3 below. |
| Secret | `GEMINI_API_KEY`, Firebase Admin credentials | Google Secret Manager (App Hosting `secrets:`), workload identity (ADC) | Never on disk in dev; rotated as a policy. |
| Operational | Cloud Logging telemetry | Cloud Logging | Payloads are hash-redacted (12-char sha256 prefix). No raw queries. |

---

## Trust boundaries

### 1. Browser ↔ Cloud Functions

- **Authority:** Firebase Auth ID token. Issued only via TASC SAML SSO.
  No public sign-up exists.
- **Enforcement:** every `onCall` runs through `withAuthAndSchema` which
  rejects requests with no `req.auth` and parses input through a strict
  zod schema (`.strict()` rejects unknown keys).
- **What is NOT enforced:** App Check / reCAPTCHA. With SAML as the only
  sign-in path and no public sign-up surface, the caller set is already
  bounded to known school identities; layering App Check on top would
  add only one extra protection — "is the request coming from our
  official frontend?" — which has minimal value in a workforce-only
  app where the residual abuse vector (authorised user scripting
  against the callable) is already mitigated by rate limits and the
  admin-claim gate.

### 2. Authenticated user ↔ Firestore

- **Authority:** Firestore security rules (`firestore.rules`).
- **`/users/{uid}`** — a user may only create/update their own doc, and
  the rule whitelists exactly the self-service fields. `role` is never
  writeable from the client; the authoritative admin signal is the
  Firebase Auth custom claim (`request.auth.token.role`).
- **`/ai_tools/*`** — public read. Write requires admin custom claim;
  there is no `role`-from-Firestore path.
- **`/ai_tools/{id}/reviews/{reviewId}`** — write requires
  `reviewId == auth.uid` AND `request.resource.data.userId == auth.uid`,
  so a user cannot post a review impersonating another uid.
- **`/rate_limits/{uid}/...`** — admin SDK only; clients cannot write.

### 3. AI moderation output ↔ admin decision

- **Authority:** Human admin, NOT the AI.
- `vetTool` produces a draft "vetting notes" object including compliance
  flags (`gdprCompliant`, `coppaCompliant`, `ferpaCompliant`,
  `unsafeDataPractices`). These are *advisory only*.
- The admin UI shows a prominent banner above the vetting notes panel
  warning that the output is AI-generated and influenced by content on
  the tool's own site (indirect prompt injection); the admin must
  manually verify every compliance claim before approving the tool.
- Defence in depth: prompts wrap all user-controlled fields in named
  data blocks (`<tool_name>`, `<learning_area>`, etc.) with explicit
  "treat as data, ignore instructions" guidance; Gemini `safetySettings`
  are applied to every flow.

### 4. Cloud Function ↔ external HTTP

- **Authority:** `functions/src/lib/url-guard.ts`.
- Every outbound `fetch` whose target host is attacker-influenced goes
  through `assertPublicUrlShape` + `assertPublicHostResolves`. Rejects
  IP literals, localhost, RFC1918, link-local (169.254/16 incl. GCP
  metadata), loopback, unique-local, and reserved ranges.
- `redirect: 'manual'` everywhere — no auto-following of 30x responses.
- 3 second `AbortSignal.timeout` on every fetch.

### 5. Browser ↔ Firebase Storage

- **Authority:** Storage security rules + content-type check.
- Every write path requires `request.resource.contentType.matches(...)`
  to be jpeg/png/webp/gif AND `request.resource.size < 2 MiB`.
- SVG is explicitly **NOT** an allowed image type — SVGs can carry
  embedded JavaScript and execute under the storage download origin.
- `users/{uid}/...` requires `auth.uid == uid` for write.

---

## Top abuse cases

| Vector | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Authorised user scripts the AI callables to drain Gemini quota | Medium | Medium ($ exposure) | Per-uid daily AI budget (200 weighted units / day, admins exempt for vetting workflows). Concurrency + maxInstances caps. |
| Compromised admin account approves a maliciously-vetted tool | Low (SAML hardens this) | High (tool ships to NSW teachers) | AI vetting marked advisory; admin must manually re-confirm every compliance flag. Two-person review recommended for sensitive tools. |
| Prompt-injection page steers AI ranking or vetting | High (content from open web) | Medium | All user-controlled strings wrapped in delimited data blocks; flow outputs filtered against caller-supplied ID sets where applicable; AI moderation never decisive. |
| SSRF via tool URL submission | High (anyone can submit a URL) | High (GCP metadata, internal endpoints) | `url-guard` rejects IP literals + private/link-local hosts before fetch; no redirect following; 3s timeout. |
| Identity spoofing via Firestore writes | Medium (authorised user) | Medium (review reputation damage) | Identity for review writes comes from Firebase Auth (`user.displayName`, `user.photoURL`), not from the mutable Firestore user doc. |
| Privilege escalation via `userDoc.role` regression | Low | Critical (full admin access) | Firestore rules reject `role` in client writes. Admin gate uses Firebase Auth custom claim, NOT the Firestore field. The Firestore field is no longer written by the client at all. |
| Stored XSS via SVG avatar/logo upload | Low | High | SVG removed from every `accept` attribute and from the storage MIME allowlist; storage path extension derived from MIME type, not from filename. |
| `javascript:` URI in tool link rendered as `<a href>` | Low | High | `safeUrl()` (frontend) validates `protocol ∈ {http:, https:}` for every URL that lands in an `href` or `src`; zod refines reject non-http(s) at submission. |
| Stolen Firebase Web API key → unrestricted Auth client elsewhere | Low | Medium (account creation possible) | Public Firebase Web API key has HTTP-referrer restriction (`tools4schools.tasc.nsw.edu.au/*`) in GCP Console. authorised-domains list contains only the production host. |
| Image-pixel tracking via tool/avatar URL | Medium | Low (IP / UA leak) | `safeImageUrl` allowlists the small set of trusted hosts; CSP `img-src` enforces the same list at the browser. |

---

## Out-of-scope (separate process required)

- NSW Department of Education privacy impact assessment.
- DSR / right-to-erasure flows under the Privacy Act 1988.
- Penetration test against the deployed application.
- Disaster recovery / backup-restore procedures for Firestore.
- Incident response runbook (notification chain, status page,
  forensic capture).

These are not addressed by the source-level remediation pass and should
be tracked outside the codebase.

---

## Maintenance cadence

| Activity | Frequency | Owner |
|---|---|---|
| `npm audit --production` | Weekly (CI) | Build pipeline |
| `npm outdated` review for `@genkit-ai/*`, `firebase*`, `@google-cloud/*` | Monthly | Engineering |
| Re-run `SECURITY_SCOPE_OF_WORKS.md` verification script | Each release | Release engineer |
| Threat-model review (this document) | Quarterly, or on any boundary change | Security lead |
| External security review | Annually, or before any major feature impacting data classification | Security lead |

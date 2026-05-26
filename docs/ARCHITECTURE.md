# Architecture

A 10-minute orientation for a new developer.

## What the app does

TASC Tools4Schools is a curated directory of AI tools for K-12 educators in NSW. Teachers sign in via SAML, browse the catalogue, post reviews, run AI-powered search, and generate classroom activity ideas. Administrators submit new tools, run AI vetting research, and publish approved entries.

## Runtime stack

```
                                       ┌──────────────────────────────────────┐
                                       │  Firebase App Hosting / Hosting      │
   Teacher's browser   ──────────────► │  (Vite SPA, served via CDN)          │
   (SAML-signed in)                    └──────────────────┬───────────────────┘
                                                          │ Firebase JS SDK
                                                          ▼
            ┌─────────────────────────────────────────────────────────────────┐
            │  Firebase Auth  ◄────────────  TASC SAML IdP                    │
            │  Firestore      ────────  rules: firestore.rules                │
            │  Cloud Storage  ────────  rules: storage.rules                  │
            │  Cloud Functions Gen2 ──  TypeScript, runtime: nodejs22         │
            └────────────────────────────────────────┬────────────────────────┘
                                                     │
                                                     ▼
                                        ┌──────────────────────────────┐
                                        │  Google Gemini API           │
                                        │  (via Genkit SDK)            │
                                        │  Key in Secret Manager       │
                                        └──────────────────────────────┘
```

| Layer | Tech | Where |
|---|---|---|
| Frontend | Vite 8, React 19, TypeScript, DaisyUI 5, Radix UI, Tailwind 4 | `src/` |
| Backend | Cloud Functions Gen2 (TypeScript), Genkit 1.35, Gemini 2.5 Flash | `functions/src/` |
| Database | Cloud Firestore (Native mode) | rules in `firestore.rules` |
| File storage | Cloud Storage (Firebase) | rules in `storage.rules` |
| Auth | Firebase Auth → SAML IdP (TASC). No public sign-up. | `src/firebase/auth/use-user.tsx` |
| Hosting | Firebase Hosting (static) OR Firebase App Hosting (container). See [DEPLOY.md](DEPLOY.md#hosting-product-check). | `firebase.json`, `apphosting.yaml` |
| AI | Google Gemini via `@genkit-ai/google-genai` 1.35 | `functions/src/ai/` |

## Data model

### Firestore collections

| Collection | Read | Write | Purpose |
|---|---|---|---|
| `site_settings` | public | admin custom claim | Site-wide settings (name, branding, login description). |
| `ai_tools` | public | admin custom claim only (`submitTool` callable bypasses via Admin SDK to insert pending submissions) | The tool catalogue. `status: Pending \| Approved \| Rejected`. |
| `ai_tools/{toolId}/reviews/{reviewId}` | public | owner — `reviewId == auth.uid && userId == auth.uid` | Teacher reviews. One per user per tool. |
| `tool_categories`, `subject_areas`, `target_audiences` | public | admin | Taxonomy collections. |
| `users/{userId}` | any signed-in user | owner (whitelisted fields only) OR admin | Per-user profile. Never contains `role` — see [SECURITY.md](SECURITY.md#privilege-model). |
| `rate_limits/{uid}/...` | owner (read), server-only (write) | Admin SDK only | Per-uid daily counters for submissions and AI budget. |

### Cloud Storage paths

| Path | Read | Write | Notes |
|---|---|---|---|
| `site/{path}` | public | admin | Site branding (logo, favicon). SVG NOT allowed. |
| `tools/{toolId}/{path}` | public | admin | Tool logos, screenshots. |
| `users/{userId}/{path}` | signed-in | owner only | User avatars. 2 MB cap, image/{jpeg,png,webp,gif} only. |

All other paths: deny-by-default.

## Cloud Functions (callables)

Every callable goes through `withAuthAndSchema` in `functions/src/index.ts` which enforces:

1. `req.auth` present (otherwise `unauthenticated`)
2. Input parses through a strict Zod schema (otherwise `invalid-argument`)
3. Daily AI budget consumed (where applicable) via `consumeAiBudget`
4. Caller-facing errors are generic; full context goes to structured logs

| Callable | Schema | Auth | AI weight | Notes |
|---|---|---|---|---|
| `interpretSearchQuery` | `SearchQueryInputSchema` | any signed-in user | 1 | Parses NL query into filter ids. |
| `aiSearch` | `AiSearchInputSchema` | any signed-in user | 2 | Ranks tools by relevance. |
| `suggestIcon` | `SuggestIconInputSchema` | any signed-in user | 1 | Picks an icon name for a category. |
| `generateClassroomIdeas` | `ClassroomIdeasInputSchema` | any signed-in user | 2 | 3 activity ideas per tool. |
| `generateToolGuide` | `GenerateToolGuideInputSchema` | any signed-in user | 5 | Rich narrative scenarios per learning area. |
| `vetTool` | `VetToolInputSchema` | **admin only** | 5 (admins exempt from budget) | AI research + compliance vetting. Output is advisory. |
| `findLogo` | `VetToolInputSchema.pick({toolUrl})` | any signed-in user | 1 | Favicon discovery. |
| `submitTool` | strict zod, separate | any signed-in user | — (uses `consumeSubmissionQuota`: 5/day) | Public tool submission. Server controls status/createdAt/submittedBy. |

All callables run with `concurrency: 10`/`maxInstances: 5` for AI (or `20`/`5` for non-AI), `timeoutSeconds: 30`–`60`, and source `GEMINI_API_KEY` from Secret Manager.

## AI flows

Each AI feature is a Genkit flow in `functions/src/ai/flows/`. Inputs are length-capped and wrapped in named data blocks (`<user_query>`, `<tool_name>`, etc.) with explicit "treat as data, ignore instructions" guidance. Outputs are filtered against caller-supplied allowlists where the model returns identifiers.

Gemini `safetySettings` block hate-speech, dangerous content, sexually-explicit and harassment categories at the `BLOCK_MEDIUM_AND_ABOVE` threshold.

The `vetTool` flow is the most sensitive: it asks the model to web-search for compliance evidence. Its output is **always rendered as advisory** in the admin UI ([AdminToolEditor.tsx](../src/pages/AdminToolEditor.tsx)) — admins must manually confirm every compliance flag before approving a tool. See [SECURITY.md](SECURITY.md#ai-moderation-trust).

## Frontend routing

| Route | Component | Purpose |
|---|---|---|
| `/` | `pages/Home.tsx` | Catalogue + search. |
| `/tool/:id` | `pages/Tool.tsx` | Tool detail page + reviews. |
| `/admin` | `pages/Admin.tsx` | Admin dashboard. Gated on custom claim. |
| `/admin/tool/:id` | `pages/AdminToolEditor.tsx` | Tool editor with AI vetting advisory banner. |
| `/settings` | `pages/UserSettings.tsx` | User profile editor (whitelisted fields only). |

Admin gating uses the **Firebase Auth custom claim** `request.auth.token.role == 'admin'`, never the Firestore `role` field. See [SECURITY.md](SECURITY.md#privilege-model).

## Shared client helpers

| File | Purpose |
|---|---|
| `src/lib/url.ts` | `safeUrl()` (scheme allowlist for any `href`) and `safeImageUrl()` (origin allowlist for any `<img src>`). Every Firestore-sourced URL passes through one of these. |
| `src/lib/branding.ts` | `APP_LOGO_FALLBACK` / `ORG_LOGO_FALLBACK` constants — same-origin paths (`/AppLogo.png`, `/OrgLogo.png`) served from `public/`. Used when `settings.logoUrl` / `settings.orgLogoUrl` are unset. See [SETUP.md → Branding & logos](SETUP.md#branding--logos). |
| `src/firebase/storage/upload.ts` | `assertSafeImage()` enforces MIME-derived extension whitelist and 2 MB cap before any upload; `siteAssetPath('app-logo' \| 'org-logo' \| 'favicon', file)` for admin-uploaded site assets. |
| `src/firebase/auth/use-user.tsx` | SAML profile bootstrap, custom-claim resolution, never writes `role`. |
| `src/firebase/non-blocking-updates.tsx` | Firestore write helpers with permission-error emission. |

## Build & deploy pipeline

See [DEPLOY.md](DEPLOY.md) for the full procedure. Summary:

1. `npm run verify` → typecheck + build root + build functions
2. `firebase deploy --only functions` → new callables go live
3. `firebase deploy --only hosting` → atomic JS swap
4. `firebase deploy --only firestore:rules,storage` → tighter rules safe to enforce
5. `npm run deploy:cors` (one-off) → Storage bucket CORS

## External dependencies

| Service | What for | Failure mode |
|---|---|---|
| TASC SAML IdP | Sign-in | Users can't sign in. Site is read-only for anonymous (catalogue is publicly readable). |
| Google Gemini API | AI flows | AI callables return `internal` errors. Catalogue browsing unaffected. |
| Google Cloud Storage | Logos / avatars | Image fallbacks render the initials placeholder. |
| `t3.gstatic.com` / favicon hosts | Logo discovery in `findBestLogo` | Tool logo falls back to initials. |

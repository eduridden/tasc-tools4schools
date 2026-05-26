# Setup

For a new developer joining the project. From "no code on my machine" to "running the app locally".

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| **Node.js** | 22.x LTS | Vite, Cloud Functions, and tsc all require Node 22+. Use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) so the version matches `package.json`'s `engines` field. |
| **npm** | 10.x or later | Comes with Node 22. |
| **git** | Any modern version | Version control. |
| **Firebase CLI** | Latest | `npm install -g firebase-tools`. Required to deploy and to run Firebase Emulators. |
| **gcloud CLI** | Latest (optional) | Only needed for the one-time Storage CORS update (`npm run deploy:cors`) and any direct Google Cloud Console work. [Install guide](https://cloud.google.com/sdk/docs/install). |

Confirm Node version:
```bash
node --version    # should report v22.x
```

## Firebase project access

You need:

1. **Editor** (or higher) IAM role on the Firebase project `studio-5930603892-a77bc`. Ask the existing maintainers to add you.
2. To be logged in via `firebase login` with the same Google account.
3. To have the project selected as your default in this repo:
   ```bash
   firebase use studio-5930603892-a77bc
   ```

## Repository clone & install

```bash
git clone <repo-url>
cd TASC-Tools4Schools

# Frontend deps
npm install

# Cloud Functions deps (separate package)
cd functions && npm install && cd ..
```

`npm install` will succeed cleanly on Node 22 LTS. Both folders have their own `package-lock.json` — do not delete them; that's how reproducible installs work.

## Secrets

This codebase has **no `.env` files**. Secrets live in Google Secret Manager and are mounted into Cloud Functions at runtime via the `secrets:` parameter in `functions/src/index.ts`. The frontend bundle contains only the *public* Firebase Web API key, which is safe to ship (it's a project identifier, not a secret).

| Secret | Where it lives | When you need it |
|---|---|---|
| `GEMINI_API_KEY` | Google Secret Manager (production) | If you want to invoke AI callables locally via the Functions Emulator. See "Local AI development" below. |
| Firebase service account | Application Default Credentials (ADC) via `gcloud auth application-default login` | Only if you run the Admin SDK locally outside the emulator. Rarely needed. |

**Do not** create a `.env` file at the repo root, and **do not** download a Firebase service-account JSON to disk. Both are anti-patterns for this project and both are in `.gitignore` + `.dockerignore` so the tooling will not pick them up if you do.

## Running the app locally

The simplest setup — frontend dev server pointing at the deployed Cloud Functions:

```bash
npm run dev
```

This starts Vite at <http://localhost:3000>. Sign in via the production SAML flow; data writes go to the production Firestore.

> Local dev hits **production** Cloud Functions and **production** Firestore by default. Be careful with admin actions.

### Optional: Firebase Emulators

For end-to-end local development against an isolated emulator suite:

```bash
# In one terminal — start emulators (Firestore, Functions, Storage, Auth)
firebase emulators:start

# In another — start Vite (the SDK auto-detects the emulators at localhost)
npm run dev
```

### Optional: Local AI development

If you want to invoke AI callables (e.g. `aiSearch`, `vetTool`) against the local Functions Emulator, you need a Gemini API key on your machine:

```bash
# Generate a personal Gemini key from https://aistudio.google.com/app/apikey
export GEMINI_API_KEY="..."
firebase emulators:start --only functions
```

The emulator inherits your shell environment, so the `secrets: ['GEMINI_API_KEY']` declaration in the function picks it up. **Never** commit this key or export it from a long-lived shell profile.

## Common dev commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server at <http://localhost:3000> |
| `npm run typecheck` | TypeScript check on the frontend |
| `npm run build` | Production build of the frontend to `dist/` |
| `npm run build:functions` | TypeScript compile of Cloud Functions |
| `npm run build:all` | Both bundles |
| `npm run verify` | `typecheck` + `build:all`. Run before any deploy. |
| `npm run preview` | Serve the production `dist/` locally to smoke-test. |

Deploy commands live in [DEPLOY.md](DEPLOY.md).

## Branding & logos

The app surfaces two logos:

| Slot | Where it shows | Source of truth |
|---|---|---|
| **App Logo** | Header (every authenticated page) + left column of the login page | `settings.logoUrl` in Firestore `site_settings/global` (admin upload), or the static fallback at `public/AppLogo.png` |
| **Organisation Logo** | Right column of the login page + the SSO modal | `settings.orgLogoUrl` in Firestore `site_settings/global` (admin upload), or the static fallback at `public/OrgLogo.png` |

The static fallbacks ship bundled with the SPA — `public/AppLogo.png` and `public/OrgLogo.png` are copied verbatim into `dist/` by `vite build`, so they're served same-origin by Firebase Hosting. This means **the login page renders correct branding even if Firebase Storage is unreachable**.

### First-time setup (forking the app for a new organisation)

If you've forked this codebase to brand it for a new organisation:

1. **Replace the static fallback images** with your own assets — same filenames, same paths:
   ```
   public/AppLogo.png       # your app brand mark (left of login + header)
   public/OrgLogo.png       # your organisation brand mark (right of login + SSO modal)
   ```
   Use **PNG** (other formats need a code change). Keep them under a few hundred KB; they're loaded on every page render until the user signs in.
2. Run `npm run build` to confirm the new files land in `dist/`:
   ```bash
   npm run build
   ls -la dist/AppLogo.png dist/OrgLogo.png   # both should exist
   ```
3. Deploy the new bundle (`npm run deploy:hosting`). The fallbacks are now live for every visitor who hasn't seen an admin-uploaded override.

### Admin overrides at runtime (no redeploy needed)

After deploy, an admin can override either logo per-environment without touching code:

1. Sign in as an admin.
2. Open **Admin → Site Settings → Branding**.
3. Use "Upload App Logo" or "Upload Organisation Logo" — the file is uploaded to Firebase Storage (`site/app-logo.{ext}` or `site/org-logo.{ext}`, MIME-derived extension, 2 MB cap, no SVG allowed) and the download URL is written to Firestore.
4. Use "Remove (use default)" to clear the Firestore field — the static fallback from `public/` kicks back in.

Same flow applies to **separate environments** (staging, production, fork-for-another-school): deploy once with your codebase-baked fallbacks, then let each environment's admins upload an environment-specific logo on top.

### What admins cannot do

The admin upload writes go through:
- `src/firebase/storage/upload.ts::assertSafeImage` — rejects non-image MIME, rejects SVG (would carry script if loaded from the storage origin), caps file size at 2 MB.
- `storage.rules` enforces the same MIME allowlist + size cap server-side.
- `src/lib/url.ts::safeImageUrl` allowlists the rendered hosts (Firebase Storage, googleusercontent, gstatic, tasc.nsw.edu.au, same-origin).
- CSP `img-src` in `firebase.json` enforces the same host allowlist at the browser.

So an admin cannot upload an SVG-with-script, set the logo URL to an arbitrary host, or inject anything that lands outside an `<img>` tag.

## Editor setup

- **VS Code** is the default — `.vscode/` is checked in. Install the recommended extensions (TypeScript, ESLint, Tailwind CSS IntelliSense).
- The project uses **TypeScript strict mode** (`tsconfig.json`). Treat any type error as a blocker.
- **DaisyUI** is the component library — see [`/CLAUDE.md`](../CLAUDE.md) at the repo root for the canonical component rules.

## Project layout

```
TASC-Tools4Schools/
├── public/                    # Static SPA assets (copied verbatim into dist/)
│   ├── AppLogo.png            #   App Logo fallback (see "Branding & logos")
│   └── OrgLogo.png            #   Organisation Logo fallback
├── src/                       # Vite React SPA
│   ├── components/            # React components (DaisyUI + Radix UI)
│   ├── pages/                 # Top-level routed pages
│   ├── firebase/              # Firebase client SDK wiring (auth, firestore, storage)
│   ├── hooks/                 # Custom hooks
│   └── lib/                   # Helpers — url.ts, branding.ts (fallback consts), types
├── functions/                 # Cloud Functions Gen2
│   └── src/
│       ├── ai/flows/          # Genkit AI flows (1 file per callable)
│       ├── ai/schemas.ts      # Zod schemas shared between flows
│       ├── ai/genkit.ts       # Genkit client init
│       ├── lib/
│       │   ├── url-guard.ts   # SSRF-safe URL validation + fetch
│       │   ├── rate-limit.ts  # Per-uid daily quota / AI budget
│       │   └── logo-finder.ts # Tool favicon discovery
│       ├── tools.ts           # submitTool callable
│       └── index.ts           # Callable wiring + auth gate
├── docs/                      # This documentation
├── firestore.rules            # Firestore security rules
├── storage.rules              # Cloud Storage security rules
├── firebase.json              # Firebase Hosting + functions config (with security headers)
├── apphosting.yaml            # Firebase App Hosting backend config
├── cors.json                  # Storage bucket CORS allowlist
├── Dockerfile                 # Multi-stage build (Node 22 → nginx:alpine)
├── .dockerignore              # Keeps secrets/build artefacts out of Docker context
└── package.json               # Root npm scripts incl. `npm run deploy`
```

## Licence

This codebase is released under the **PolyForm Noncommercial License 1.0.0** ([full text](../LICENSE)). The plain-English summary lives in the [root README → Licence](../README.md#licence) section. Schools, charities, universities, public research bodies, and government institutions may use, adapt, and redistribute this code at no charge; **commercial use requires a separate written licence from TASC**.

If you've forked this codebase for another school or noncommercial institution, you must:

1. Keep the `LICENSE` file at the repo root, unmodified.
2. Keep the **Required Notice** line at the bottom of the LICENSE file (`Copyright © … The Anglican Schools Corporation …`) in any redistribution.
3. Optionally add your own `Required Notice:` line for your additions — PolyForm chains notices forward to downstream users.

## Need help?

- Architecture overview: [ARCHITECTURE.md](ARCHITECTURE.md)
- Security posture (what's defended, what isn't): [SECURITY.md](SECURITY.md)
- Deploying to production: [DEPLOY.md](DEPLOY.md)
- Existing maintainer escalation: TASC Digital Innovation Team.

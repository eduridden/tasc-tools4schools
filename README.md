# TASC Tools4Schools

An AI-powered directory of educational technology tools developed for **The Anglican Schools Corporation (TASC)**. Teachers sign in via SAML, browse a curated catalogue of vetted AI tools, run AI-powered search, and generate classroom activity ideas tailored to NSW learning areas. Admins submit new tools, run AI vetting research, and publish approved entries.

Production: <https://tools4schools.tasc.nsw.edu.au/>

## Quick start

```bash
# 1. Install
git clone <repo-url> && cd TASC-Tools4Schools
npm install
(cd functions && npm install)

# 2. Authenticate to the Firebase project
firebase login
firebase use studio-5930603892-a77bc

# 3. Run locally
npm run dev          # Vite dev server at http://localhost:3000
```

For a fuller setup walkthrough — prerequisites, SAML notes, optional emulator setup, and local AI development — see [docs/SETUP.md](docs/SETUP.md).

## Common commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server. |
| `npm run typecheck` | TypeScript check on the frontend. |
| `npm run verify` | Typecheck + build root + build functions. Run before any deploy. |
| `npm run deploy` | Verify, then deploy in safe order: **functions → hosting → rules**. |

Sub-deploy scripts (`deploy:functions`, `deploy:hosting`, `deploy:rules`, `deploy:cors`) are listed in [docs/DEPLOY.md](docs/DEPLOY.md) with the rationale for the ordering and the post-deploy smoke tests.

## Documentation

| Doc | When to read |
|---|---|
| [docs/SETUP.md](docs/SETUP.md) | First-time machine setup, local dev, emulators. |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Production deploys, rollback, one-off operator steps. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | What runs where — frontend, functions, data model. |
| [docs/SECURITY.md](docs/SECURITY.md) | Trust model, controls in place, "adding a new feature" checklist. |
| [docs/security/THREAT_MODEL.md](docs/security/THREAT_MODEL.md) | Trust boundaries, data classifications, abuse cases. |

For the historical record of the code-red security remediation, see [SECURITY_SCOPE_OF_WORKS.md](SECURITY_SCOPE_OF_WORKS.md) and [SECURITY-WAIVERS.md](SECURITY-WAIVERS.md).

## Stack

- **Frontend:** Vite 8 · React 19 · TypeScript · DaisyUI 5 · Radix UI · Tailwind 4
- **Backend:** Firebase Cloud Functions Gen2 (Node 22) · Genkit 1.35 · Google Gemini
- **Data:** Cloud Firestore · Cloud Storage
- **Auth:** Firebase Auth → TASC SAML IdP (no public sign-up)
- **Hosting:** Firebase Hosting / Firebase App Hosting

## Licence

This codebase is released under the [**PolyForm Noncommercial License 1.0.0**](LICENSE) (SPDX: `PolyForm-Noncommercial-1.0.0`).

In plain terms:

| You can | You cannot |
|---|---|
| Use this code at a school, charity, university, public research body, or government institution | Use this code in a commercial product, paid SaaS, or anything sold for profit |
| Fork, adapt, and redistribute it for noncommercial use | Sublicense or transfer your licence to a commercial party |
| Build classroom tools, personal projects, hobby projects on top of it | Charge users for access to a service built on this code |
| Use it inside another educational institution at no charge | Bundle it into a closed-source commercial product |

Commercial use requires a separate written licence from TASC. Contact the TASC Digital Innovation Team to negotiate one.

This is a **source-available** licence — it is not OSI-approved "open source" because the Open Source Definition requires permitting commercial use. PolyForm Noncommercial is lawyer-drafted and widely recognised; see [polyformproject.org/licenses/noncommercial/1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/) for the canonical text.

## Ownership

This project is owned by **The Anglican Schools Corporation (TASC)**. The author and maintainer of the codebase is Julian Ridden, Head of AI at TASC.

## Ownership

This codebase is provided as-is and comes with no form of support or maintenance responsibilities from **The Anglican Schools Corporation (TASC)**.
---

*Copyright © 2024–2026 The Anglican Schools Corporation. Released under the PolyForm Noncommercial License 1.0.0 — see [LICENSE](LICENSE).*

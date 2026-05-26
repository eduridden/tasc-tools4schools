# Deployment

Production URL: <https://tools4schools.tasc.nsw.edu.au/>

Firebase project: `studio-5930603892-a77bc`

## TL;DR

```bash
npm run deploy
```

That's the master command. It runs `verify` (typecheck + build both bundles) then deploys in the safe order: **functions → hosting → rules**. See [Why this order](#why-this-order) below.

## Sub-scripts

The master `deploy` chains these in sequence — you can also run them individually for partial deploys:

| Script | What it does |
|---|---|
| `npm run verify` | Typecheck + build root + build functions. Aborts the chain if anything fails. |
| `npm run deploy:functions` | `firebase deploy --only functions` |
| `npm run deploy:hosting` | `firebase deploy --only hosting` (classic Firebase Hosting from `dist/`) |
| `npm run deploy:rules` | `firebase deploy --only firestore:rules,storage` (the `storage` target deploys `storage.rules` — Firebase CLI doesn't subscope storage with `:rules`) |
| `npm run deploy:cors` | `gsutil cors set cors.json gs://studio-5930603892-a77bc.firebasestorage.app` — separate, needs `gsutil` |

## Why this order

The deploy sequence exists because a naive "deploy everything" can leave the site in a broken state for the seconds-to-minutes a deploy takes.

1. **Functions first** — adds the new callables (`submitTool`, AI endpoints) alongside the old ones. Existing clients are unaffected.
2. **Hosting second** — atomic JS swap. New browser sessions immediately use the new bundle and the new callables.
3. **Rules last** — Firestore and Storage rules tighten only after both the frontend and the functions are on the new flow. If you flipped this order, any user still on the old bundle would fail their first-login Firestore write (the old code wrote `role: 'user'` on user-doc create, which the new rules forbid) and tool submissions would fail (the old code wrote directly to the `ai_tools` collection, which the new rules also forbid).

## First-time deployer one-off steps

These are **not** part of `npm run deploy` because they only need to happen once (or rarely):

### 1. Storage CORS

`cors.json` lives in the repo but Firebase does not auto-apply it. Run once after changing it:

```bash
npm run deploy:cors
# requires gsutil + gcloud auth on the project
```

### 2. Firebase Console — authorised domains

In **Firebase Console → Authentication → Settings → Authorized domains**, confirm only the production host is listed:

- `tools4schools.tasc.nsw.edu.au`

If you see wildcards (`*.us-central1.hosted.app`, `*.cloudworkstations.dev`) — those were removed from `apphosting.yaml` in the security pass but the Firebase Console list is a separate setting. Remove them manually too.

### 3. Public Firebase Web API key referrer restriction

In **GCP Console → APIs & Services → Credentials**, find the Web API key from `src/firebase/config.ts` and set an **HTTP referrer restriction** to:

- `https://tools4schools.tasc.nsw.edu.au/*`

The Web API key is a public identifier, not a secret, but restricting it stops it being reused on other origins.

### 4. Branding (App Logo + Organisation Logo)

The two logos that ship in the SPA bundle live at:

```
public/AppLogo.png       # Tools4Schools app brand mark
public/OrgLogo.png       # TASC organisation brand mark
```

If you're forking the app for a different organisation, replace these PNGs **before the first deploy** so the static fallbacks reflect your branding. After deploy, admins can override either logo at runtime via **Admin → Site Settings → Branding** without a redeploy. Full instructions in [SETUP.md → Branding & logos](SETUP.md#branding--logos).

### 5. Secret Manager — `GEMINI_API_KEY`

Already wired into `apphosting.yaml` and into every AI callable via the `secrets: ['GEMINI_API_KEY']` parameter. If you ever rotate the key:

```bash
echo -n "<new-key>" | gcloud secrets versions add GEMINI_API_KEY --data-file=-
firebase deploy --only functions  # pick up the new secret version
```

## Hosting product check

This repo contains config for **both** Firebase Hosting (classic, static SPA from `dist/`) AND Firebase App Hosting (`apphosting.yaml`). The two products are different and deploy via different commands.

`npm run deploy:hosting` targets **classic Firebase Hosting**. Verify with:

```bash
firebase hosting:sites:list           # classic Hosting sites
firebase apphosting:backends:list     # App Hosting backends
```

If the production traffic is served by **App Hosting**, replace `deploy:hosting` in `package.json` with:

```bash
firebase apphosting:rollouts:create <backend-id>
```

…or push to the git branch the App Hosting backend tracks (it auto-deploys on push).

## Post-deploy smoke tests

After `npm run deploy` finishes, before walking away from the keyboard:

```bash
# 1. Production loads
curl -sI https://tools4schools.tasc.nsw.edu.au/ | head -5
# expect: HTTP/2 200, no obvious errors

# 2. Security headers landed
curl -sI https://tools4schools.tasc.nsw.edu.au/ | grep -iE "content-security-policy|strict-transport|x-frame-options|referrer-policy"
# expect: 4 matching header lines

# 3. Callables respond (unauthenticated should be 401/403, not 200)
curl -s -X POST https://us-central1-studio-5930603892-a77bc.cloudfunctions.net/submitTool \
  -H 'Content-Type: application/json' -d '{"data":{}}' | head -3
# expect: {"error":{"status":"UNAUTHENTICATED",...}} — NOT a 200 success
```

Then in a browser:

1. Sign in via SAML — confirm your user doc is created in Firestore *without* a `role` field. (Use the Firestore console to inspect.)
2. Open browser devtools → Application → try `firebase.firestore().collection('users').doc('<your-uid>').update({role:'admin'})`. Should fail with `permission-denied`.
3. Submit a tool from the UI — confirm it shows up in Firestore with `status: 'Pending'` and `submittedBy: <your-uid>`.

If any of the above misbehaves, see [Rollback](#rollback).

## Rollback

Firebase deploys are versioned. To roll back any single surface:

```bash
# Functions: re-deploy the previous git ref's functions/lib output
git checkout <previous-good-commit> -- functions/
(cd functions && npm ci && npm run build)
firebase deploy --only functions

# Hosting: use the Firebase Console — Hosting → Release History → "Rollback"

# Firestore/Storage rules: re-deploy the previous git ref's rules files
git checkout <previous-good-commit> -- firestore.rules storage.rules
firebase deploy --only firestore:rules,storage
```

Always roll back in **reverse** order: rules → hosting → functions, so the old clients aren't talking to the new functions/rules during the rollback window.

## CI/CD note

There is currently **no CI/CD pipeline** wired to a remote git host. Deploys happen from a maintainer's laptop. If a CI runner is added (e.g. GitHub Actions, Cloud Build), it must:

- Run `npm run verify` and fail the build on any non-zero exit.
- Run `npm audit --production --audit-level=critical` (root) and fail on any critical.
- For App Hosting: a `git push` to the tracked branch is sufficient.
- For classic Hosting: invoke `firebase deploy --only hosting` with a CI-only Firebase token (`firebase login:ci`).

See [SECURITY.md](SECURITY.md#dependency-hygiene) for the audit waiver list that CI should tolerate.

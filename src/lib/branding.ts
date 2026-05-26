/**
 * Branding fallback URLs.
 *
 * Two logos are surfaced through the admin Site Settings UI:
 *   - **App Logo** — the Tools4Schools brand mark (left column on the login
 *     page, header).
 *   - **Organisation Logo** — the TASC corporate mark (right column on the
 *     login page).
 *
 * Admin-uploaded versions live in Firebase Storage at
 * `site/app-logo.{ext}` / `site/org-logo.{ext}` and their download URLs
 * are persisted to Firestore (`site_settings.global.logoUrl` /
 * `orgLogoUrl`). When the admin hasn't uploaded, components fall back to
 * the constants below.
 *
 * **The fallbacks resolve to same-origin static assets** (`public/AppLogo.png`
 * and `public/OrgLogo.png`, copied into `dist/` by Vite at build time).
 * This means the login page renders correctly even if Firebase Storage is
 * unreachable — a hard outage of Storage no longer breaks branding.
 */

export const APP_LOGO_FALLBACK = '/AppLogo.png';
export const ORG_LOGO_FALLBACK = '/OrgLogo.png';

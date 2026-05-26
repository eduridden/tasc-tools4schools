/**
 * Client-side URL safety helpers.
 *
 * - `safeUrl` is used wherever a Firestore-sourced or user-supplied string is
 *   bound to an `href` or `window.location` target. Returns an empty string
 *   for anything that isn't a valid `http(s)://` URL — preventing
 *   `javascript:`, `data:`, `vbscript:`, and unknown schemes from ever
 *   reaching the DOM.
 *
 * - `safeImageUrl` further restricts to an allowlist of image-hosting
 *   origins, used wherever a Firestore-sourced URL becomes an `<img src>`.
 *   This prevents tool/avatar/logo entries from issuing requests to
 *   attacker-controlled hosts (IP/UA leakage, tracker pixels, request
 *   smuggling via response shape).
 */

const SAFE_PROTOCOLS = new Set(['http:', 'https:']);

const ALLOWED_IMAGE_HOSTS: Array<RegExp | string> = [
  // Firebase Storage download URLs (canonical and bucket forms).
  /\.firebasestorage\.app$/i,
  /\.firebasestorage\.googleapis\.com$/i,
  'firebasestorage.googleapis.com',
  // Google identity / favicon services (used for OAuth profile photos
  // and the favicon lookup that backs tool logos).
  /\.googleusercontent\.com$/i,
  /\.gstatic\.com$/i,
  // TASC's own domain — for assets served from the school environment.
  /\.tasc\.nsw\.edu\.au$/i,
  'tasc.nsw.edu.au',
];

/**
 * Returns an http/https URL string, or an empty string if the input is not
 * a valid public-scheme URL. Always pass external URLs through this before
 * binding to `href`.
 */
export function safeUrl(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  // If the string lacks a scheme, default to https:// so naked domains still
  // work. We never default to http:// — that would be a silent downgrade.
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (!SAFE_PROTOCOLS.has(parsed.protocol)) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function isAllowedImageHost(host: string): boolean {
  const lower = host.toLowerCase();
  for (const matcher of ALLOWED_IMAGE_HOSTS) {
    if (typeof matcher === 'string') {
      if (lower === matcher) return true;
    } else if (matcher.test(lower)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns an https URL whose host is on the image-host allowlist, or empty
 * string. Use for every `<img src>` whose value comes from Firestore.
 *
 * Plain relative paths (no scheme, no `://`) are passed through unchanged
 * — they refer to the app's own origin, which is always safe.
 */
export function safeImageUrl(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  // Relative paths are same-origin — allow.
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  // data:image/... is unsafe (can carry SVG-with-script). Block.
  if (trimmed.startsWith('data:')) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return '';
    if (!isAllowedImageHost(parsed.hostname)) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

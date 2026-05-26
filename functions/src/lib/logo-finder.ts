/**
 * Logo discovery service.
 *
 * Hardened against SSRF: every outbound `fetch` is gated through the
 * url-guard module which validates the URL shape, resolves the hostname,
 * and rejects anything that lands in a private / link-local / loopback
 * range. Redirects are not followed.
 */

import { assertPublicUrlShape, safeHeadFetch } from "./url-guard";

/**
 * Extracts the registrable domain heuristically. Not PSL-aware (so e.g.
 * `tools.tasc.nsw.edu.au` is reduced to `edu.au`), which is acceptable
 * for favicon lookup because we only use the result against `t3.gstatic.com`
 * and against the original host with `/favicon.ico`.
 */
function getDomainFromUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

async function isImageResponse(url: string): Promise<boolean> {
  const res = await safeHeadFetch(url, 3000);
  if (!res || !res.ok) return false;
  const contentType = res.headers.get("Content-Type") ?? "";
  return contentType.startsWith("image/");
}

/**
 * Finds the best logo for a given tool URL using a prioritised, multi-step
 * check. Returns the chosen logo URL or null.
 *
 * The caller MUST have validated `toolUrl` via `assertPublicUrlShape` before
 * calling this. We re-validate here as defence in depth.
 */
export async function findBestLogo(toolUrl: string): Promise<string | null> {
  try {
    assertPublicUrlShape(toolUrl);
  } catch {
    return null;
  }

  const domain = getDomainFromUrl(toolUrl);
  if (!domain) return null;

  // 1. Google's favicon service — fixed, trusted host.
  const googleFavicon =
    `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&` +
    `fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`;
  if (await isImageResponse(googleFavicon)) {
    return googleFavicon;
  }

  // 2. Direct favicon at the tool's own host — but only after the same
  //    public-host check we apply to user-supplied URLs.
  const directFavicon = `https://${domain}/favicon.ico`;
  if (await isImageResponse(directFavicon)) {
    return directFavicon;
  }

  return null;
}

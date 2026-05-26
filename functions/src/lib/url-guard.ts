/**
 * SSRF / outbound-URL safety helpers.
 *
 * Used to validate any URL that:
 *   (a) comes from a callable's user input (e.g. `toolUrl` in `findLogo`)
 *   (b) comes from a model's output (e.g. `documentationUrl` returned by `vetTool`)
 *
 * before performing an outbound `fetch` from inside the Functions network.
 *
 * Protections:
 *   - Reject non-HTTPS schemes (no http:, no file:, no javascript:, no data:).
 *   - Reject IP-literal hostnames (IPv4 and IPv6).
 *   - Reject localhost, *.local, *.internal, and `.lan` suffixes.
 *   - DNS-resolve the hostname and reject if any resolved address falls in a
 *     private, loopback, link-local, or unique-local range.
 *
 * Callers must additionally pass `redirect: 'manual'` and a short timeout to
 * `fetch`. This module does NOT implement TOCTOU-safe (resolved-IP-pinned)
 * fetching; if that is required, switch to an HTTP agent with a custom
 * `lookup` callback.
 */

import { promises as dns } from 'node:dns';
import * as net from 'node:net';

const BLOCKED_SUFFIXES = ['.local', '.internal', '.lan', '.localhost'];

function ipv4InPrivateRange(ip: string): boolean {
  const parts = ip.split('.').map(n => Number(n));
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n) || n < 0 || n > 255)) {
    return true; // malformed → treat as unsafe
  }
  const [a, b] = parts;
  if (a === 10) return true;                              // 10.0.0.0/8
  if (a === 127) return true;                             // 127.0.0.0/8 (loopback)
  if (a === 0) return true;                               // 0.0.0.0/8
  if (a === 169 && b === 254) return true;                // 169.254.0.0/16 (link-local + metadata)
  if (a === 172 && b >= 16 && b <= 31) return true;       // 172.16.0.0/12
  if (a === 192 && b === 168) return true;                // 192.168.0.0/16
  if (a === 192 && b === 0 && parts[2] === 0) return true; // 192.0.0.0/24 (IETF protocol assignments)
  if (a === 100 && b >= 64 && b <= 127) return true;      // 100.64.0.0/10 (CGNAT)
  if (a >= 224) return true;                              // 224+ multicast / reserved
  return false;
}

function ipv6InPrivateRange(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (lower === '::1' || lower === '::') return true;     // loopback / unspecified
  if (lower.startsWith('fe80:')) return true;             // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local
  if (lower.startsWith('ff')) return true;                // multicast
  // ::ffff:a.b.c.d (v4-mapped) — check underlying v4
  const v4Mapped = lower.match(/^::ffff:([0-9.]+)$/);
  if (v4Mapped) return ipv4InPrivateRange(v4Mapped[1]);
  return false;
}

function ipInPrivateRange(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return ipv4InPrivateRange(ip);
  if (family === 6) return ipv6InPrivateRange(ip);
  return true; // not a recognisable IP → unsafe
}

/**
 * Synchronously checks the URL shape. Returns the parsed URL or throws.
 * Does NOT do DNS resolution — caller should pair with `assertPublicHostResolves`
 * before issuing the outbound fetch when the host is attacker-controlled.
 */
export function assertPublicUrlShape(raw: string): URL {
  if (!raw || typeof raw !== 'string') {
    throw new Error('URL is required');
  }
  if (raw.length > 2048) {
    throw new Error('URL exceeds maximum length');
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('URL is malformed');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('URL must use https://');
  }
  const host = parsed.hostname.toLowerCase();
  if (!host) throw new Error('URL has no hostname');

  // Reject IP-literal hosts outright — public sites use names.
  if (net.isIP(host) || net.isIP(host.replace(/^\[|\]$/g, ''))) {
    throw new Error('URL uses an IP-literal host');
  }
  if (host === 'localhost') {
    throw new Error('URL targets localhost');
  }
  for (const suffix of BLOCKED_SUFFIXES) {
    if (host.endsWith(suffix)) {
      throw new Error(`URL uses a blocked suffix (${suffix})`);
    }
  }
  return parsed;
}

/**
 * Resolves the URL's hostname via DNS and throws if any resolved address falls
 * in a private / link-local / loopback / unique-local range. Note: this is not
 * TOCTOU-safe — the host could resolve differently when the actual fetch runs.
 * For strong protection, pair with a `fetch`-agent `lookup` callback that pins
 * the resolved IP. For this codebase the threat model accepts that risk.
 */
export async function assertPublicHostResolves(parsed: URL): Promise<void> {
  let addrs: { address: string }[];
  try {
    addrs = await dns.lookup(parsed.hostname, { all: true });
  } catch {
    throw new Error('Hostname did not resolve');
  }
  if (addrs.length === 0) {
    throw new Error('Hostname did not resolve');
  }
  for (const { address } of addrs) {
    if (ipInPrivateRange(address)) {
      throw new Error('Hostname resolves to a non-public address');
    }
  }
}

/**
 * Convenience wrapper: validate shape AND resolve. Returns the parsed URL on
 * success; throws on any failure.
 */
export async function assertPublicUrl(raw: string): Promise<URL> {
  const parsed = assertPublicUrlShape(raw);
  await assertPublicHostResolves(parsed);
  return parsed;
}

/**
 * Boolean form for use in zod `.refine()` (sync — shape only, no DNS).
 */
export function isPublicUrlShape(raw: string): boolean {
  try {
    assertPublicUrlShape(raw);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safe HEAD fetch with: public-host check, manual redirect, short timeout.
 * Returns the Response object or null on any failure.
 */
export async function safeHeadFetch(raw: string, timeoutMs = 3000): Promise<Response | null> {
  let parsed: URL;
  try {
    parsed = await assertPublicUrl(raw);
  } catch {
    return null;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(parsed.toString(), {
      method: 'HEAD',
      redirect: 'manual',
      signal: controller.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

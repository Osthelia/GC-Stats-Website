/**
 * GC-Stats - client-ip
 *
 * Best-effort client IP from proxy headers, used for auth throttling only,
 * never as an identity/security boundary on its own.
 *
 * Traefik is the only proxy in front of the app and appends the address it saw
 * to `x-forwarded-for`; everything left of that is whatever the client sent, so
 * only the entry TRUSTED_PROXY_COUNT hops from the right is trusted.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export function getClientIp(headers: Headers): string {
  // The leftmost entries are whatever the client sent. Each trusted proxy
  // appends the address it saw, so the real client sits TRUSTED_PROXY_COUNT
  // entries from the right.
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const hops = forwardedFor.split(",").map((h) => h.trim()).filter(Boolean);
    const trusted = Math.max(1, Number.parseInt(process.env.TRUSTED_PROXY_COUNT ?? "1", 10) || 1);
    const ip = hops[Math.max(0, hops.length - trusted)];
    if (ip) return ip;
  }
  return headers.get("x-real-ip") ?? "unknown";
}

/**
 * GC-Stats - client-ip
 *
 * Best-effort client IP from proxy headers, used for auth throttling only,
 * never as an identity/security boundary on its own.
 *
 * On Cloudflare, `cf-connecting-ip` is set by the edge itself and overwritten
 * on every request, so a client can't forge it. `x-forwarded-for` has no such
 * guarantee here (nothing validates the request actually came through our
 * proxy first), so it's only trusted as a fallback for non-Cloudflare deploys.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export function getClientIp(headers: Headers): string {
  if (process.env.DEPLOY_TARGET === "cloudflare") {
    return headers.get("cf-connecting-ip") ?? "unknown";
  }

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

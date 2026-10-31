/**
 * GC-Stats - webhooks url-guard
 *
 * Keeps webhook deliveries on the public internet: https only, no
 * credentials, no private, loopback or link local address. The address is
 * checked again at connection time (custom DNS lookup), so a hostname that
 * resolves to a private address later is still refused.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import dns from "node:dns";
import net from "node:net";
import { WEBHOOK_LIMITS } from "./shared";

export type WebhookUrlError = "required" | "tooLong" | "invalid" | "notHttps" | "credentials" | "privateHost";

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home.arpa"];

const BLOCKED_RANGES = new net.BlockList();
for (const [prefix, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3],
] as const) BLOCKED_RANGES.addSubnet(prefix, bits, "ipv4");
// IPv4 mapped addresses (::ffff:a.b.c.d) are checked against the IPv4 ranges by BlockList itself.
// Other IPv6 forms embedding an IPv4 address (compatible, NAT64, 6to4, Teredo) are refused whole.
for (const [prefix, bits] of [
  ["::", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 32],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) BLOCKED_RANGES.addSubnet(prefix, bits, "ipv6");

/** True for any address a webhook must never reach. */
export function isPrivateAddress(ip: string): boolean {
  const family = net.isIPv4(ip) ? "ipv4" : net.isIPv6(ip) ? "ipv6" : null;
  if (!family) return true;
  return BLOCKED_RANGES.check(ip, family);
}

/** Static checks done when an endpoint is saved. */
export function validateWebhookUrl(raw: unknown): { ok: true; url: string } | { ok: false; error: WebhookUrlError } {
  if (typeof raw !== "string" || raw.trim() === "") return { ok: false, error: "required" };
  const value = raw.trim();
  if (value.length > WEBHOOK_LIMITS.urlMaxLength) return { ok: false, error: "tooLong" };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "invalid" };
  }
  if (url.protocol !== "https:") return { ok: false, error: "notHttps" };
  if (url.username || url.password) return { ok: false, error: "credentials" };

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host.includes(".") && !net.isIP(host)) return { ok: false, error: "privateHost" };
  if (host === "localhost" || BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return { ok: false, error: "privateHost" };
  if (net.isIP(host) && isPrivateAddress(host)) return { ok: false, error: "privateHost" };

  return { ok: true, url: url.toString() };
}

/** `lookup` for https.request: resolves like Node does, then refuses private addresses. */
export const guardedLookup: typeof dns.lookup = ((hostname: string, options: dns.LookupOptions, callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void) => {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "");
    const list = addresses as dns.LookupAddress[];
    const blocked = list.find((a) => isPrivateAddress(a.address));
    const first = list[0];
    if (!first || blocked) {
      const refused: NodeJS.ErrnoException = new Error("webhook host resolves to a private address");
      refused.code = "EPRIVATEHOST";
      return callback(refused, "");
    }
    if (options.all) return callback(null, list);
    return callback(null, first.address, first.family);
  });
}) as typeof dns.lookup;

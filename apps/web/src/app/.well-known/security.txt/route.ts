/**
 * GC-Stats - security.txt (RFC 9116)
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { APP_BASE_URL } from "@/lib/notify";

export const dynamic = "force-dynamic";

const REPOSITORY_URL = "https://github.com/Osthelia/GC-Stats-Website";
const VALIDITY_DAYS = 180;

export function GET() {
  // Rolling expiry, truncated to the day so the file stays stable between requests.
  const expires = new Date(Date.now() + VALIDITY_DAYS * 86_400_000);
  expires.setUTCHours(0, 0, 0, 0);

  const body = [
    "Contact: mailto:tech@osthelia.org",
    `Contact: ${REPOSITORY_URL}/security/advisories/new`,
    `Expires: ${expires.toISOString()}`,
    "Preferred-Languages: en, fr",
    `Canonical: ${APP_BASE_URL}/.well-known/security.txt`,
    `Policy: ${REPOSITORY_URL}/blob/main/SECURITY.md`,
    "",
  ].join("\n");

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
}

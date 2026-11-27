/**
 * GC-Stats - host-meta (RFC 6415)
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { APP_BASE_URL } from "@/lib/notify";

export const dynamic = "force-dynamic";

const LINKS = [
  { rel: "service-desc", type: "application/json", path: "/api/openapi.json" },
  { rel: "service-doc", type: "text/html", path: "/en/developers-doc" },
  { rel: "terms-of-service", type: "text/html", path: "/en/terms" },
  { rel: "privacy-policy", type: "text/html", path: "/en/privacy" },
];

export function GET() {
  const links = LINKS.map((link) => `  <Link rel="${link.rel}" type="${link.type}" href="${APP_BASE_URL}${link.path}"/>`);
  const body = ['<?xml version="1.0" encoding="UTF-8"?>', '<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">', ...links, "</XRD>", ""].join("\n");

  return new Response(body, { headers: { "Content-Type": "application/xrd+xml; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
}

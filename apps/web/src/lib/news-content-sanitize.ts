/**
 * GC-Stats - news-content-sanitize
 *
 * Server-side HTML allow-list sanitizer run on every news article save, not
 * just trusted client-side. Matches exactly what Tiptap's editor extensions
 * can emit, so nothing legitimate gets stripped.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import sanitizeHtml from "sanitize-html";

// Mirrors V1's App\Services\HtmlSanitizer allow-list (run server-side on
// every save, not just trusted at the client) — Tiptap's default StarterKit
// + image/link/underline/color extensions only ever emit tags/attrs within
// this list, so nothing legitimate gets stripped.
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "img",
  "code",
  "pre",
  "span",
];

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  a: ["href", "target", "rel"],
  img: ["src", "alt", "width", "height"],
  span: ["style"],
};

/** Only `color`/`background-color` on a `<span style="...">` — matches Tiptap's forecolor/backcolor output, same allow-list shape V1 gave its own sanitizer. */
const ALLOWED_STYLES: sanitizeHtml.IOptions["allowedStyles"] = {
  span: {
    color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(/],
    "background-color": [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(/],
  },
};

export function sanitizeNewsContent(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedStyles: ALLOWED_STYLES,
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow" }, true),
    },
  });
}

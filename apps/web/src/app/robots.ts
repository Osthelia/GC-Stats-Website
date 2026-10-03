/**
 * GC-Stats - robots
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { MetadataRoute } from "next";

/**
 * Search engines may index the public site (V1's robots.txt, plus the V2
 * private areas). AI crawlers and SEO/data scrapers are refused site-wide:
 * the data is available through the API under its own terms, not for
 * bulk harvesting or model training.
 */

// AI training / AI assistant crawlers.
const AI_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "Google-Extended",
  "GoogleOther",
  "Applebot-Extended",
  "CCBot",
  "PerplexityBot",
  "Perplexity-User",
  "Bytespider",
  "meta-externalagent",
  "meta-externalfetcher",
  "FacebookBot",
  "Amazonbot",
  "cohere-ai",
  "cohere-training-data-crawler",
  "Diffbot",
  "YouBot",
  "AI2Bot",
  "Ai2Bot-Dolma",
  "DuckAssistBot",
  "MistralAI-User",
  "PanguBot",
  "Timpibot",
  "omgili",
  "omgilibot",
  "ImagesiftBot",
  "Kangaroo Bot",
  "img2dataset",
  "webzio-extended",
];

// SEO tools and generic scrapers.
const SCRAPER_BOTS = [
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "DotBot",
  "BLEXBot",
  "DataForSeoBot",
  "SeekportBot",
  "PetalBot",
  "magpie-crawler",
  "Scrapy",
  "python-requests",
  "Go-http-client",
  "curl",
  "Wget",
];

// Private or non-indexable areas, under every locale prefix.
const PRIVATE_PATHS = ["/storage/", "/api/", "/oauth/", "/*/oauth/", "/*/admin", "/*/dashboard", "/*/settings", "/*/widget/", "/*/login", "/*/register", "/*/forgot-password", "/*/reset-password", "/*/verify-email", "/*/search"];

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

  return {
    rules: [
      { userAgent: [...AI_BOTS, ...SCRAPER_BOTS], disallow: "/" },
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}

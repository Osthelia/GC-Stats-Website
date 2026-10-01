/**
 * GC-Stats - cloudflare-env-extra.d
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export {};

// wrangler types only types a secret (no `vars` entry in wrangler.jsonc) when a
// local .env file defines it at generation time. That's fine on a dev machine
// but not guaranteed on whatever runs `npm run deploy`/`cf-build`, so CRON_SECRET
// (see custom-worker.ts) is declared here instead, merged onto the generated
// CloudflareEnv interface regardless of what ran cf-typegen last.
declare global {
  interface CloudflareEnv {
    CRON_SECRET: string;
  }
}

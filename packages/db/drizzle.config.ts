/**
 * GC-Stats — drizzle.config
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { defineConfig } from "drizzle-kit";

// `db:generate` only diffs the schema against ./drizzle — no live DB needed.
// `db:migrate` needs DATABASE_URL pointing at a real Postgres instance.
export default defineConfig({
  schema: "./src/schema/*.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://placeholder",
  },
});

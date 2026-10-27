/**
 * GC-Stats — custom-types module
 *
 * Drizzle custom column types for Postgres range types (daterange,
 * tstzrange), which drizzle-orm/pg-core has no built-in builder for.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { customType } from "drizzle-orm/pg-core";

// Drizzle has no first-class range type builder. Values round-trip as the
// Postgres range literal string (e.g. "[2024-01-01,2024-06-01)") — parse with
// a range-literal helper on read if you need the bounds in JS.
export const daterange = customType<{ data: string }>({
  dataType() {
    return "daterange";
  },
});

export const tstzrange = customType<{ data: string }>({
  dataType() {
    return "tstzrange";
  },
});

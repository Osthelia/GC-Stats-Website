/**
 * GC-Stats — custom-types module
 *
 * Drizzle custom column types for Postgres types drizzle-orm/pg-core has no
 * builder for: the range types (daterange, tstzrange) and bytea.
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

// Raw bytes, e.g. a gzipped file. Node and Workers both return a Buffer/Uint8Array from pg.
export const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
  toDriver(value) {
    return Buffer.from(value);
  },
  fromDriver(value) {
    return new Uint8Array(value);
  },
});

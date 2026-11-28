/**
 * GC-Stats - db-errors
 *
 * Reading Postgres errors that Drizzle wraps.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

/** Drizzle wraps the driver's error, so the Postgres code and constraint can sit on the error or on one of its causes. */
export function isUniqueViolation(err: unknown, constraint: string): boolean {
  for (let current: unknown = err; current; current = (current as { cause?: unknown }).cause) {
    const { code, constraint: name } = current as { code?: string; constraint?: string };
    if (code === "23505" && name === constraint) return true;
  }
  return false;
}

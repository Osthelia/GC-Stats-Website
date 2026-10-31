/**
 * GC-Stats - column-filter
 *
 * Validation shared by the column filter modal and the servers reading its filters.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

/** 9 digits keeps the value inside a Postgres integer. */
export const INTEGER_FILTER_PATTERN = /^\d{1,9}$/;

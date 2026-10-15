/**
 * GC-Stats - navigation
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

// Locale-aware Link/router/pathname helpers, use these instead of
// next/link and next/navigation anywhere a link should stay in-locale.
// Link and useRouter also complete per-game paths, see game-navigation.tsx.
export { redirect, usePathname, getPathname } from "./intl-navigation";
export { Link, useRouter } from "./game-navigation";

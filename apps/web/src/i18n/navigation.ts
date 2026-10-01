/**
 * GC-Stats - navigation
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware Link/router/pathname helpers — use these instead of
// next/link and next/navigation anywhere a link should stay in-locale.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);

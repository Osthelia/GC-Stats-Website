/**
 * GC-Stats - Proxy utilities
 *
 * i18n routing middleware (Next.js 16 renamed the "middleware" file
 * convention to "proxy"), matches all routes except API, internal Next.js
 * assets, and files with an extension.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next.js 16 renamed the "middleware" file convention to "proxy".
export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};

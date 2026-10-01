/**
 * GC-Stats — route
 *
 * Auth.js catch-all route handler, exports the GET/POST handlers generated
 * from the app's auth config.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { handlers } from "@/auth";

export const { GET, POST } = handlers;

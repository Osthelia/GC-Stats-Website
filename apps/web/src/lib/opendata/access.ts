/**
 * GC-Stats - opendata access
 *
 * Whether the current visitor can use the OpenData portal, for the public
 * pages (the API applies the same rules in handler.ts).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getCurrentUserId } from "@/lib/session";
import { getOpenDataConfig } from "./config";
import type { OpenDataConfig } from "./config-shared";

export type OpenDataAccess = { config: OpenDataConfig; blocked: "disabled" | "accountRequired" | null };

export async function getOpenDataAccess(): Promise<OpenDataAccess> {
  const config = await getOpenDataConfig();
  if (!config.enabled) return { config, blocked: "disabled" };
  if (config.requireAccount && !(await getCurrentUserId())) return { config, blocked: "accountRequired" };
  return { config, blocked: null };
}

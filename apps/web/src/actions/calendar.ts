"use server";

import { headers } from "next/headers";
import { getClientIp } from "@/lib/client-ip";
import { checkSearchThrottle } from "@/lib/search-throttle";
import { searchTeamsQuery, type TeamPickerResult } from "@/lib/team-search";

export async function searchCalendarTeams(query: string): Promise<TeamPickerResult[]> {
  if (typeof query !== "string") return [];
  const term = query.trim().slice(0, 100);
  if (term.length < 2) return [];

  const ip = getClientIp(await headers());
  let allowed = true;
  try {
    allowed = await checkSearchThrottle(ip);
  } catch (error) {
    // Match the public search endpoint's behavior if rate-limit storage fails.
    console.warn("[calendar] Search throttle check failed, allowing request", error);
  }
  if (!allowed) throw new Error("Too many search requests");

  return searchTeamsQuery(term);
}

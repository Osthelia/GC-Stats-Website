/**
 * GC-Stats - organization-tags
 *
 * Fixed, curated vocabulary for `organizations.tags` (what an organization
 * does, shown to visitors), not a free-text field, so the value stays clean
 * and translatable. Plain module on purpose: a "use server" file can only
 * export async functions, so a client component importing a const array
 * from there would break at runtime.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export const ORGANIZATION_TAGS = ["tournament_organizer", "production", "media", "broadcaster", "agency", "community", "esports_coverage"] as const;

export type OrganizationTag = (typeof ORGANIZATION_TAGS)[number];

// Shared accent per tag, same idea as organization-roles.ts::organizationRoleColor — a
// tag reads the same color everywhere it's shown (currently only /admin/organizations).
const ORGANIZATION_TAG_STYLES: Record<OrganizationTag, string> = {
  tournament_organizer: "bg-amber-400/10 text-amber-300 border-amber-400/20",
  production: "bg-orange-400/10 text-orange-300 border-orange-400/20",
  media: "bg-sky-400/10 text-sky-300 border-sky-400/20",
  broadcaster: "bg-violet-400/10 text-violet-300 border-violet-400/20",
  agency: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
  community: "bg-pink-400/10 text-pink-300 border-pink-400/20",
  esports_coverage: "bg-cyan-400/10 text-cyan-300 border-cyan-400/20",
};
const DEFAULT_ORGANIZATION_TAG_STYLE = "bg-muted text-muted-foreground border-border";

export function organizationTagStyle(tag: string): string {
  return ORGANIZATION_TAG_STYLES[tag as OrganizationTag] ?? DEFAULT_ORGANIZATION_TAG_STYLE;
}

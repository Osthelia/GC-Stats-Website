/**
 * GC-Stats - roster-roles
 *
 * Roster role list, mirroring V1 RosterService::ROLES base list (without the
 * '-inactive' suffixed variants, replaced by the real
 * roster_memberships.inactive_since column instead). Also derives a role
 * group and its card accent colors for the admin roster UI.
 *
 * Plain module on purpose: a "use server" file (actions/admin-teams.ts) can
 * only export async functions, Next replaces every other export with a
 * server-reference proxy, so a client component importing a const array from
 * there gets a non-array at runtime (`ROSTER_ROLES.map is not a function`).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export const ROSTER_ROLES = ["player", "player-igl", "sub", "coach", "assistant coach", "performance coach", "analyst", "manager"] as const;

// Mirrors V1's App\Helpers\RosterRole::group()/barClass()/badgeClass() —
// buckets a role into a group purely for the card's accent color, then a
// per-group Tailwind class pair (colored left bar + badge). An inactive
// member always reads as the neutral "inactive" group regardless of role,
// same as V1. Colors are plain Tailwind palette entries (not the public
// site's --brand-yellow etc.) since admin uses the shadcn design system,
// not the public site's — see CLAUDE.md's admin/site component split.
export type RosterRoleGroup = "igl" | "player" | "sub" | "manager" | "staff" | "inactive";

const ROLE_GROUPS: Record<string, RosterRoleGroup> = {
  "player-igl": "igl",
  player: "player",
  sub: "sub",
  manager: "manager",
};

const GROUP_STYLES: Record<RosterRoleGroup, { bar: string; badgeBg: string; badgeText: string }> = {
  igl: { bar: "bg-purple-400", badgeBg: "bg-purple-400/10", badgeText: "text-purple-300" },
  player: { bar: "bg-amber-400", badgeBg: "bg-amber-400/10", badgeText: "text-amber-300" },
  sub: { bar: "bg-sky-400", badgeBg: "bg-sky-400/10", badgeText: "text-sky-300" },
  staff: { bar: "bg-purple-400", badgeBg: "bg-purple-400/10", badgeText: "text-purple-300" },
  manager: { bar: "bg-orange-400", badgeBg: "bg-orange-400/10", badgeText: "text-orange-300" },
  inactive: { bar: "bg-gray-500", badgeBg: "bg-gray-500/10", badgeText: "text-gray-400" },
};

export function rosterRoleGroup(role: string, isInactive: boolean): RosterRoleGroup {
  if (isInactive) return "inactive";
  return ROLE_GROUPS[role] ?? "staff";
}

export function rosterRoleStyles(role: string, isInactive: boolean) {
  return GROUP_STYLES[rosterRoleGroup(role, isInactive)];
}

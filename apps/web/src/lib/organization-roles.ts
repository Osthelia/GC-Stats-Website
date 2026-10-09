/**
 * GC-Stats - organization-roles
 *
 * Canonical set offered by the "add member" role picker, and the shared
 * color per role used for badges site-wide. `organization_memberships.role`
 * itself stays free text at the schema level, but a fixed list keeps the
 * admin UI a real styled select instead of a free-text input. Plain module
 * on purpose: a "use server" file can only export async functions, so a
 * client component importing a const array from there would break at runtime.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export const ORGANIZATION_MEMBER_ROLES = [
  "owner",
  "president",
  "coPresident",
  "vicePresident",
  "ceo",
  "coCeo",
  "generalDirector",
  "admin",
  "secretary",
  "treasurer",
  "tournamentAdmin",
  "communityManager",
  "moderator",
  "editor",
  "journalist",
  "caster",
  "observer",
  "producer",
  "manager",
  "partnershipsManager",
  "communicationsManager",
  "recruitmentManager",
  "headOfValorant",
  "streamer",
  "developer",
  "volunteer",
] as const;

export type OrganizationMemberRole = (typeof ORGANIZATION_MEMBER_ROLES)[number];

// Shared accent per role — used by the public org roster (organization-members.tsx)
// and by anywhere else a role badge for a person's org involvement is shown
// (player experience tab, production credits), so the same role always reads
// the same color across the site. production_credits.role isn't drawn from
// this same vocabulary (see production-credit-roles.ts) but overlapping
// values (caster/observer/producer/editor) still get a meaningful color; any
// value with no entry falls back to a neutral gray rather than crashing.
export type OrganizationRoleColor = { bg: string; text: string; ring: string };

const ORGANIZATION_ROLE_COLORS: Record<string, OrganizationRoleColor> = {
  owner: { bg: "rgba(228,174,34,0.14)", text: "#e4ae22", ring: "rgba(228,174,34,0.35)" },
  president: { bg: "rgba(228,174,34,0.14)", text: "#e4ae22", ring: "rgba(228,174,34,0.35)" },
  coPresident: { bg: "rgba(228,174,34,0.1)", text: "#d9b95c", ring: "rgba(228,174,34,0.25)" },
  vicePresident: { bg: "rgba(228,174,34,0.1)", text: "#d9b95c", ring: "rgba(228,174,34,0.25)" },
  ceo: { bg: "rgba(228,174,34,0.14)", text: "#e4ae22", ring: "rgba(228,174,34,0.35)" },
  coCeo: { bg: "rgba(228,174,34,0.1)", text: "#d9b95c", ring: "rgba(228,174,34,0.25)" },
  generalDirector: { bg: "rgba(228,174,34,0.1)", text: "#d9b95c", ring: "rgba(228,174,34,0.25)" },
  admin: { bg: "rgba(228,174,34,0.1)", text: "#d9b95c", ring: "rgba(228,174,34,0.25)" },
  tournamentAdmin: { bg: "rgba(228,174,34,0.1)", text: "#d9b95c", ring: "rgba(228,174,34,0.25)" },
  editor: { bg: "rgba(56,189,248,0.12)", text: "#7dd3fc", ring: "rgba(56,189,248,0.3)" },
  developer: { bg: "rgba(56,189,248,0.12)", text: "#7dd3fc", ring: "rgba(56,189,248,0.3)" },
  caster: { bg: "rgba(192,132,252,0.12)", text: "#d8b4fe", ring: "rgba(192,132,252,0.3)" },
  observer: { bg: "rgba(192,132,252,0.12)", text: "#d8b4fe", ring: "rgba(192,132,252,0.3)" },
  moderator: { bg: "rgba(192,132,252,0.12)", text: "#d8b4fe", ring: "rgba(192,132,252,0.3)" },
  journalist: { bg: "rgba(192,132,252,0.12)", text: "#d8b4fe", ring: "rgba(192,132,252,0.3)" },
  communityManager: { bg: "rgba(192,132,252,0.12)", text: "#d8b4fe", ring: "rgba(192,132,252,0.3)" },
  producer: { bg: "rgba(251,146,60,0.12)", text: "#fdba74", ring: "rgba(251,146,60,0.3)" },
  manager: { bg: "rgba(251,146,60,0.12)", text: "#fdba74", ring: "rgba(251,146,60,0.3)" },
  partnershipsManager: { bg: "rgba(251,146,60,0.12)", text: "#fdba74", ring: "rgba(251,146,60,0.3)" },
  communicationsManager: { bg: "rgba(251,146,60,0.12)", text: "#fdba74", ring: "rgba(251,146,60,0.3)" },
  recruitmentManager: { bg: "rgba(251,146,60,0.12)", text: "#fdba74", ring: "rgba(251,146,60,0.3)" },
  headOfValorant: { bg: "rgba(251,146,60,0.12)", text: "#fdba74", ring: "rgba(251,146,60,0.3)" },
  streamer: { bg: "rgba(192,132,252,0.12)", text: "#d8b4fe", ring: "rgba(192,132,252,0.3)" },
  secretary: { bg: "rgba(251,146,60,0.12)", text: "#fdba74", ring: "rgba(251,146,60,0.3)" },
  treasurer: { bg: "rgba(251,146,60,0.12)", text: "#fdba74", ring: "rgba(251,146,60,0.3)" },
  volunteer: { bg: "rgba(251,146,60,0.12)", text: "#fdba74", ring: "rgba(251,146,60,0.3)" },
};
const DEFAULT_ORGANIZATION_ROLE_COLOR: OrganizationRoleColor = { bg: "rgba(255,255,255,0.06)", text: "#a3a3a3", ring: "rgba(255,255,255,0.15)" };

export function organizationRoleColor(role: string): OrganizationRoleColor {
  return ORGANIZATION_ROLE_COLORS[role] ?? DEFAULT_ORGANIZATION_ROLE_COLOR;
}

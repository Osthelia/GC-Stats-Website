/**
 * GC-Stats - player-current-organizations
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { PersonOrganization } from "@/lib/person-organizations-data";
import { OrgBadge } from "@/components/organization/org-badge";
import { organizationRoleColor } from "@/lib/organization-roles";
import { displayMonthYear } from "@/lib/daterange";

/**
 * Mirrors `PlayerCurrentTeam` but for organization involvement (staff/caster/
 * producer roles, see organization_memberships) — most players have none, so
 * the overview panel passes `hideWhenEmpty` (renders nothing rather than an
 * empty-state card); the Production tab always shows it, with its own
 * empty state.
 */
export async function PlayerCurrentOrganizations({
  organizations,
  pronouns,
  hideWhenEmpty = false,
}: {
  organizations: PersonOrganization[];
  pronouns?: number | null;
  hideWhenEmpty?: boolean;
}) {
  const t = await getTranslations("playerPage");
  const tRoles = await getTranslations("organizationPage.roleOptions");

  if (hideWhenEmpty && organizations.length === 0) return null;

  return (
    <div>
      <h2 className="mb-3 text-[13px] font-extrabold tracking-[0.13em] text-neutral-50 uppercase">{t("currentOrganizations")}</h2>

      {organizations.length === 0 ? (
        <p className="text-sm text-neutral-500">{t("noCurrentOrganizations")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {organizations.map((org) => {
            const color = organizationRoleColor(org.role);
            const roleLabel = tRoles.has(org.role) ? tRoles(org.role, { pronouns: pronouns ?? 2 }) : org.role;
            return (
              <Link
                key={org.membershipId}
                href={`/organization/${org.organizationId}/${org.slug}`}
                className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-[var(--gcs-surface-2)] p-3 transition-colors hover:border-neutral-700"
              >
                <OrgBadge name={org.name} logoUrl={org.logoUrl} logoUrlLight={org.logoUrlLight} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold tracking-tight text-[var(--gcs-text)]">{org.name}</p>
                  <div className="mt-1 flex min-w-0 items-center gap-2">
                    <span className="flex-none rounded-sm px-1.5 py-0.5 font-mono text-[8px] font-black tracking-widest uppercase" style={{ background: color.bg, color: color.text }}>
                      {roleLabel}
                    </span>
                    <span className="truncate font-mono text-[9px] font-bold tracking-widest text-neutral-500 uppercase">{displayMonthYear(org.since, t("unknownDate"))}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

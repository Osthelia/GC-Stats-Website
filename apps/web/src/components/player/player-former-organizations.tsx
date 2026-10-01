/**
 * GC-Stats - player-former-organizations
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { PersonOrganization } from "@/lib/person-organizations-data";
import { OrgBadge } from "@/components/organization/org-badge";
import { displayMonthYear } from "@/lib/daterange";

/** Production-tab-only counterpart to `PlayerCurrentOrganizations` — no overview teaser (unlike former teams), since most players have none at all. */
export async function PlayerFormerOrganizations({ organizations, pronouns }: { organizations: PersonOrganization[]; pronouns?: number | null }) {
  const t = await getTranslations("playerPage");
  const tRoles = await getTranslations("organizationPage.roleOptions");

  return (
    <div>
      <h2 className="mb-3 text-[13px] font-extrabold tracking-[0.13em] text-neutral-50 uppercase">{t("formerOrganizations")}</h2>

      {organizations.length === 0 ? (
        <p className="text-sm text-neutral-500">{t("noFormerOrganizations")}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-800">
          {organizations.map((org) => (
            <Link
              key={org.membershipId}
              href={`/organization/${org.organizationId}/${org.slug}`}
              className="grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-neutral-900 bg-[var(--gcs-surface-2)] p-2.5 transition-colors last:border-b-0 hover:bg-[var(--gcs-hover)]"
            >
              <OrgBadge name={org.name} logoUrl={org.logoUrl} logoUrlLight={org.logoUrlLight} size={30} />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[13.5px] font-semibold text-neutral-100">{org.name}</span>
                <span className="font-mono text-[9.5px] tracking-widest text-neutral-500 uppercase">{tRoles.has(org.role) ? tRoles(org.role, { pronouns: pronouns ?? 2 }) : org.role}</span>
              </span>
              <span className="font-mono text-[10.5px] text-neutral-600">
                {displayMonthYear(org.since, t("unknownDate"))} → {displayMonthYear(org.until, t("unknownDate"))}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

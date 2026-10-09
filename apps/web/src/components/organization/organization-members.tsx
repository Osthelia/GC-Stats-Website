/**
 * GC-Stats - organization-members
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { OrganizationMember } from "@/lib/organization-page-data";
import { CountryBadge } from "@/components/team/country-badge";
import { countryNames } from "@/lib/countries";
import { displayMonthYear } from "@/lib/daterange";
import { slugify } from "@/lib/entity-id";
import { organizationRoleColor } from "@/lib/organization-roles";
import type { AppLocale } from "@/i18n/routing";

// Members overview gets its own grid layout (not the vertical row list used
// for team rosters) — organizations regularly run 20-40 members (staff,
// casters, producers...), which reads far better dense than as a tall stack.
export async function OrganizationMembers({
  current,
  formers,
  labels,
}: {
  current: OrganizationMember[];
  formers: OrganizationMember[];
  /** Overrides the organization wording, e.g. "Staff" on a team page. */
  labels?: { title: string; empty: string; formers: string };
}) {
  const t = await getTranslations("organizationPage");
  const tRoles = await getTranslations("organizationPage.roleOptions");
  const locale = await getLocale();

  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-[13px] font-extrabold tracking-[0.13em] text-neutral-50 uppercase">{labels?.title ?? t("members")}</h2>
        {current.length > 0 && <span className="font-mono text-[11px] text-neutral-600">{t("memberCount", { count: current.length })}</span>}
      </div>

      {current.length === 0 ? (
        <p className="text-sm text-neutral-500">{labels?.empty ?? t("noMembers")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {current.map((m) => {
            const color = organizationRoleColor(m.role);
            const roleLabel = tRoles.has(m.role) ? tRoles(m.role, { pronouns: m.pronouns ?? 2 }) : m.role;
            return (
              <Link
                key={m.membershipId}
                href={`/player/${m.personId}/${slugify(m.handle)}`}
                className="flex flex-col items-center gap-2 rounded-xl border border-neutral-800 bg-[var(--gcs-surface-2)] p-3 text-center transition-colors hover:border-neutral-700"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full border" style={{ background: color.bg, borderColor: color.ring }}>
                  <span className="text-base font-black" style={{ color: color.text }}>
                    {m.handle.charAt(0).toUpperCase()}
                  </span>
                </span>
                <span className="flex min-w-0 items-center gap-1 text-[12.5px] font-bold text-[var(--gcs-text)]">
                  <CountryBadge code={m.countryCode} secondaryCode={m.secondaryCountryCode} label={countryNames(m.countryCode, m.secondaryCountryCode, locale as AppLocale)} />
                  <span className="max-w-[110px] truncate">{m.handle}</span>
                </span>
                <span className="rounded-sm px-1.5 py-0.5 font-mono text-[8px] font-black tracking-widest uppercase" style={{ background: color.bg, color: color.text }}>
                  {roleLabel}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {formers.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 font-mono text-[10px] tracking-[0.13em] text-neutral-600 uppercase">{labels?.formers ?? t("formerMembers")}</h3>
          <div className="flex flex-wrap gap-1.5">
            {formers.map((m) => (
              <Link
                key={m.membershipId}
                href={`/player/${m.personId}/${slugify(m.handle)}`}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-white/[0.02] px-2 py-1 text-[11.5px] text-neutral-500 transition-colors hover:border-neutral-700 hover:text-neutral-300"
                title={`${displayMonthYear(m.since, t("unknownDate"))} → ${displayMonthYear(m.until, t("unknownDate"))}`}
              >
                {m.handle}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

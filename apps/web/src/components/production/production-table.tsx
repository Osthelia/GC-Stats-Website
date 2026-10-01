/**
 * GC-Stats - production-table
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { ProductionEntry } from "@/lib/production-credits-data";
import { CountryBadge } from "@/components/team/country-badge";
import { OrgBadge } from "@/components/organization/org-badge";
import { organizationRoleColor } from "@/lib/organization-roles";
import { SortLink } from "@/components/filters/sort-link";
import { slugify } from "@/lib/entity-id";
import { FormattedDate } from "@/components/formatted-date";
import { abbreviateTournamentName } from "@/lib/home-data";

export type ProductionColumnSort = {
  href: string;
  active: boolean;
  direction: "asc" | "desc";
};

/**
 * Shared "Production" list for the org/tournament/player pages (never called
 * "production credit(s)" in the UI, only "Production", explicit request).
 * One row per production_credits entry: who, role, on behalf of which
 * organization, for which event, and when. Columns are built dynamically so
 * each page can drop the column that's redundant on it (a person's own name
 * on their own page, "this organization" on its own page).
 * Grid from `sm` up, stacked cards below (a scrolled grid hides what tells rows apart).
 */
export async function ProductionTable({
  entries,
  showPerson = true,
  showOrganization = true,
  /** When set, an entry targeting this exact tournament renders a shortened label ("Entire tournament" / bare match label) instead of repeating the tournament's own name, used on the tournament page only. */
  currentTournamentId,
  eventColumnLabel,
  eventSort,
  dateSort,
  emptyLabel,
}: {
  entries: ProductionEntry[];
  showPerson?: boolean;
  showOrganization?: boolean;
  currentTournamentId?: number;
  eventColumnLabel: string;
  eventSort: ProductionColumnSort;
  dateSort: ProductionColumnSort;
  emptyLabel?: string;
}) {
  const t = await getTranslations("production");
  const tRoles = await getTranslations("production.role");

  type Column = {
    key: string;
    header: React.ReactNode;
    width: string;
    cell: (e: ProductionEntry) => React.ReactNode;
  };

  const eventLabel = (entry: ProductionEntry): string => {
    if (entry.target.scope === "tournament") {
      if (
        currentTournamentId != null &&
        entry.target.tournamentId === currentTournamentId
      )
        return t("targetEntireTournament");
      return t("targetTournament", { name: entry.target.tournamentName });
    }
    if (
      currentTournamentId != null &&
      entry.target.tournamentId === currentTournamentId
    )
      return entry.target.label;
    return t("targetMatch", {
      label: entry.target.label,
      tournament: entry.target.tournamentName
        ? abbreviateTournamentName(entry.target.tournamentName)
        : "?",
    });
  };

  const eventHref = (entry: ProductionEntry): string =>
    entry.target.scope === "tournament"
      ? `/tournaments/${entry.target.tournamentId}/${slugify(entry.target.tournamentName)}`
      : `/match/${entry.target.matchId}`;

  const personCell = (e: ProductionEntry) => (
    <Link
      href={`/player/${e.person.id}/${slugify(e.person.handle)}`}
      className="flex min-w-0 items-center gap-1.5 font-semibold text-neutral-100 transition-colors hover:text-[#e4ae22] active:opacity-70"
    >
      <CountryBadge
        code={e.person.countryCode}
        secondaryCode={e.person.secondaryCountryCode}
      />
      <span className="truncate">{e.person.handle}</span>
    </Link>
  );

  const roleBadge = (e: ProductionEntry) => {
    const color = organizationRoleColor(e.role);
    const roleLabel = tRoles.has(e.role) ? tRoles(e.role) : e.role;
    return (
      <span
        className="w-fit flex-none rounded-sm px-1.5 py-0.5 font-mono text-[8px] font-black tracking-widest uppercase"
        style={{ background: color.bg, color: color.text }}
      >
        {roleLabel}
      </span>
    );
  };

  const titleOverride = (e: ProductionEntry) =>
    e.titleOverride ? (
      <span
        title={e.titleOverride}
        className="line-clamp-2 text-[11px] break-words text-neutral-500"
      >
        {e.titleOverride}
      </span>
    ) : null;

  const organizationCell = (e: ProductionEntry) =>
    e.organization ? (
      <Link
        href={`/organization/${e.organization.id}/${e.organization.slug}`}
        className="flex min-w-0 items-center gap-1.5 text-neutral-300 transition-colors hover:text-[#e4ae22] active:opacity-70"
      >
        <OrgBadge
          name={e.organization.name}
          logoUrl={e.organization.logoUrl}
          logoUrlLight={e.organization.logoUrlLight}
          size={20}
        />
        <span className="truncate">{e.organization.name}</span>
      </Link>
    ) : (
      <span className="text-neutral-600">-</span>
    );

  const dateCell = (e: ProductionEntry) =>
    e.date ? (
      <FormattedDate
        date={e.date}
        className="font-mono text-[11px] whitespace-nowrap text-neutral-500"
      />
    ) : (
      <span className="text-neutral-600">-</span>
    );

  const columns: Column[] = [];

  if (showPerson)
    columns.push({
      key: "person",
      header: t("colPerson"),
      width: "minmax(0,170px)",
      cell: personCell,
    });

  columns.push({
    key: "role",
    header: t("colRole"),
    width: "minmax(0,150px)",
    cell: (e) => (
      <div className="flex min-w-0 flex-col gap-0.5">
        {roleBadge(e)}
        {titleOverride(e)}
      </div>
    ),
  });

  if (showOrganization)
    columns.push({
      key: "organization",
      header: t("colOrganization"),
      width: "minmax(0,160px)",
      cell: organizationCell,
    });

  columns.push({
    key: "event",
    header: (
      <SortLink
        label={eventColumnLabel}
        href={eventSort.href}
        active={eventSort.active}
        direction={eventSort.direction}
      />
    ),
    width: "minmax(0,1fr)",
    cell: (e) => (
      <Link
        href={eventHref(e)}
        title={eventLabel(e)}
        className="block min-w-0 truncate text-neutral-300 transition-colors hover:text-[#e4ae22] active:opacity-70"
      >
        {eventLabel(e)}
      </Link>
    ),
  });

  columns.push({
    key: "date",
    header: (
      <SortLink
        label={t("colDate")}
        href={dateSort.href}
        active={dateSort.active}
        direction={dateSort.direction}
      />
    ),
    width: "96px",
    cell: dateCell,
  });

  const gridTemplateColumns = columns.map((c) => c.width).join(" ");

  if (entries.length === 0) {
    return (
      <p className="text-sm text-neutral-500">{emptyLabel ?? t("empty")}</p>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-neutral-800 sm:block">
        <div
          className="grid gap-3 border-b border-neutral-800 bg-white/[0.02] px-3 py-2.5"
          style={{ gridTemplateColumns }}
        >
          {columns.map((c) => (
            <div
              key={c.key}
              className="flex min-w-0 items-center font-mono text-[10px] font-black tracking-[0.12em] text-neutral-500 uppercase"
            >
              {c.header}
            </div>
          ))}
        </div>
        {entries.map((e) => (
          <div
            key={e.id}
            className="grid items-center gap-3 border-b border-neutral-900 bg-[var(--gcs-surface-2)] px-3 py-2.5 text-[13px] transition-colors last:border-b-0 hover:bg-[var(--gcs-hover)]"
            style={{ gridTemplateColumns }}
          >
            {columns.map((c) => (
              <div key={c.key} className="min-w-0">
                {c.cell(e)}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:hidden">
        <div className="flex items-center gap-3 px-1 font-mono text-[10px] font-black tracking-[0.12em] text-neutral-500 uppercase">
          <SortLink
            label={eventColumnLabel}
            href={eventSort.href}
            active={eventSort.active}
            direction={eventSort.direction}
          />
          <SortLink
            label={t("colDate")}
            href={dateSort.href}
            active={dateSort.active}
            direction={dateSort.direction}
          />
        </div>
        {entries.map((e) => (
          <div
            key={e.id}
            className="flex flex-col gap-1.5 rounded-xl border border-neutral-800 bg-[var(--gcs-surface-2)] px-3 py-2.5 text-[13px]"
          >
            <div className="flex min-w-0 items-center gap-2">
              {showPerson && (
                <div className="min-w-0 flex-1">{personCell(e)}</div>
              )}
              {roleBadge(e)}
            </div>
            {titleOverride(e)}
            <Link
              href={eventHref(e)}
              className="line-clamp-2 break-words text-neutral-300 transition-colors hover:text-[#e4ae22] active:opacity-70"
            >
              {eventLabel(e)}
            </Link>
            <div className="flex min-w-0 items-center gap-2">
              {showOrganization && (
                <div className="min-w-0 flex-1">{organizationCell(e)}</div>
              )}
              <div className="ml-auto flex-none">{dateCell(e)}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

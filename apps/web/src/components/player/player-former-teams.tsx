/**
 * GC-Stats - player-former-teams
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { PlayerTeamHistoryEntry } from "@/lib/player-page-data";
import { TeamBadge } from "@/components/home/team-badge";
import { displayMonthYear } from "@/lib/daterange";
import { slugify } from "@/lib/entity-id";

// Same muted role coloring as `TeamFormerMembers` — former teams should
// read as gray/secondary at a glance, just with a faint hint of the role's
// color rather than the current-team card's vivid accent.
function mutedRoleColor(role: string): string {
  if (role === "player-igl" || role === "player") return "#9c8a5c";
  if (role === "sub") return "#6f95a8";
  if (role === "manager") return "#a4826a";
  return "#8c7f9e";
}

// The overview tab is a teaser, not the full list — anything beyond this is
// only reachable via the "Historique" link into the dedicated history page.
const MAX_SHOWN = 5;

/**
 * `limit` defaults to the 5-item overview teaser; pass `limit={null}` from
 * the full history page to render every former team. `linkHref={null}`
 * hides the "Historique" link — used on that same history page.
 */
export async function PlayerFormerTeams({
  teams,
  segment,
  limit = MAX_SHOWN,
  linkHref,
  pronouns,
}: {
  teams: PlayerTeamHistoryEntry[];
  pronouns?: number | null;
  segment: string;
  limit?: number | null;
  linkHref?: string | null;
}) {
  const t = await getTranslations("playerPage");
  const tRoles = await getTranslations("teamPage.role");
  const shown = limit == null ? teams : teams.slice(0, limit);
  const historyHref =
    linkHref === null ? null : (linkHref ?? `/player/${segment}/history`);

  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-[13px] font-extrabold tracking-[0.13em] text-neutral-50 uppercase">
          {t("formerTeams")}
        </h2>
        <span className="flex-1" />
        {historyHref && (
          <Link
            href={historyHref}
            className="font-mono text-[11px] text-[#e4ae22] hover:underline"
          >
            {t("history")}
          </Link>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-neutral-500">{t("noFormerTeams")}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-800">
          {shown.map((team) => (
            <Link
              key={`${team.teamId}-${team.role}-${team.since}`}
              href={`/team/${team.teamId}/${slugify(team.teamName)}`}
              className="grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-neutral-900 bg-[var(--gcs-surface-2)] p-2.5 transition-colors last:border-b-0 hover:bg-[var(--gcs-hover)]"
            >
              <TeamBadge
                tag={team.teamShortName ?? team.teamName}
                logoUrl={team.teamLogoUrl}
                logoUrlLight={team.teamLogoUrlLight}
                size={30}
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[13.5px] font-semibold text-neutral-100">
                  {team.teamName}
                </span>
                <span
                  className="font-mono text-[9.5px] tracking-widest uppercase"
                  style={{ color: mutedRoleColor(team.role) }}
                >
                  {tRoles.has(team.role)
                    ? tRoles(team.role, { pronouns: pronouns ?? 2 })
                    : team.role}
                </span>
              </span>
              <span className="font-mono text-[10.5px] text-neutral-600">
                {displayMonthYear(team.since, t("unknownDate"))} –{" "}
                {displayMonthYear(team.until, t("unknownDate"))}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

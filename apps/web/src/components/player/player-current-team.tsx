/**
 * GC-Stats - player-current-team
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

// Same role-group accent colors as `TeamRoster` (mirrors V1's RosterRole),
// just applied to a "which team is this person on" card instead of "who's
// on this team".
function roleAccent(role: string): { badgeBg: string; badgeText: string } {
  if (role === "player-igl" || role === "player")
    return { badgeBg: "rgba(228,174,34,0.12)", badgeText: "#e4ae22" };
  if (role === "sub")
    return { badgeBg: "rgba(56,189,248,0.12)", badgeText: "#7dd3fc" };
  if (role === "manager")
    return { badgeBg: "rgba(251,146,60,0.12)", badgeText: "#fdba74" };
  return { badgeBg: "rgba(192,132,252,0.12)", badgeText: "#d8b4fe" };
}

export async function PlayerCurrentTeam({
  teams,
  pronouns,
}: {
  teams: PlayerTeamHistoryEntry[];
  pronouns?: number | null;
}) {
  const t = await getTranslations("playerPage");
  const tRoles = await getTranslations("teamPage.role");

  return (
    <div>
      <h2 className="mb-3 text-[13px] font-extrabold tracking-[0.13em] text-neutral-50 uppercase">
        {t("currentTeam")}
      </h2>

      {teams.length === 0 ? (
        <p className="text-sm text-neutral-500">{t("noCurrentTeam")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {teams.map((team) => {
            const accent = roleAccent(team.role);
            return (
              <Link
                key={`${team.teamId}-${team.role}`}
                href={`/team/${team.teamId}/${slugify(team.teamName)}`}
                className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-[var(--gcs-surface-2)] p-3 transition-colors hover:border-neutral-700"
              >
                <TeamBadge
                  tag={team.teamShortName ?? team.teamName}
                  logoUrl={team.teamLogoUrl}
                  logoUrlLight={team.teamLogoUrlLight}
                  size={40}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold tracking-tight text-[var(--gcs-text)]">
                    {team.teamName}
                  </p>
                  <div className="mt-1 flex min-w-0 items-center gap-2">
                    <span
                      className="flex-none rounded-sm px-1.5 py-0.5 font-mono text-[8px] font-black tracking-widest uppercase"
                      style={{
                        background: accent.badgeBg,
                        color: accent.badgeText,
                      }}
                    >
                      {tRoles.has(team.role)
                        ? tRoles(team.role, { pronouns: pronouns ?? 2 })
                        : team.role}
                    </span>
                    <span className="truncate font-mono text-[9px] font-bold tracking-widest text-neutral-500 uppercase">
                      {displayMonthYear(team.since, t("unknownDate"))}
                    </span>
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

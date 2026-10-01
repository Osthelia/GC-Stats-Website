/**
 * GC-Stats - team-roster
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { TeamRosterMember } from "@/lib/team-page-data";
import { CountryBadge } from "@/components/team/country-badge";
import { displayMonthYear } from "@/lib/daterange";
import { slugify } from "@/lib/entity-id";
import { ThemedLogoImage } from "@/components/site/themed-logo-image";

// Mirrors V1's App\Helpers\RosterRole — same grouping/order/accent colors,
// ported so the "current roster" card here reads exactly like the V1 team
// page's roster list (explicit user request), just restyled to this app's
// dark tokens instead of V1's --brand-yellow/bg-[#050505].
const ROLE_ORDER = ["player-igl", "player", "sub", "coach", "assistant coach", "performance coach", "analyst", "manager"];

type RoleGroup = "igl" | "player" | "sub" | "manager" | "staff";

function roleGroup(role: string): RoleGroup {
  if (role === "player-igl") return "igl";
  if (role === "player") return "player";
  if (role === "sub") return "sub";
  if (role === "manager") return "manager";
  return "staff";
}

const GROUP_STYLES: Record<RoleGroup, { bar: string; badgeBg: string; badgeText: string }> = {
  igl: { bar: "#e4ae22", badgeBg: "rgba(228,174,34,0.12)", badgeText: "#e4ae22" },
  player: { bar: "#e4ae22", badgeBg: "rgba(228,174,34,0.12)", badgeText: "#e4ae22" },
  sub: { bar: "#38bdf8", badgeBg: "rgba(56,189,248,0.12)", badgeText: "#7dd3fc" },
  staff: { bar: "#c084fc", badgeBg: "rgba(192,132,252,0.12)", badgeText: "#d8b4fe" },
  manager: { bar: "#fb923c", badgeBg: "rgba(251,146,60,0.12)", badgeText: "#fdba74" },
};

export async function TeamRoster({ members }: { members: TeamRosterMember[] }) {
  const t = await getTranslations("teamPage");
  const players = members.filter((m) => !m.isStaff).length;
  const staff = members.length - players;

  // Mirrors V1's RosterService::ROLES ordering: every active role first (in
  // canonical order), then inactive members of any role after — not
  // interleaved by role.
  const sorted = [...members].sort((a, b) => {
    const inactiveDiff = Number(a.inactiveSince != null) - Number(b.inactiveSince != null);
    if (inactiveDiff !== 0) return inactiveDiff;
    const ai = ROLE_ORDER.indexOf(a.role);
    const bi = ROLE_ORDER.indexOf(b.role);
    return (ai === -1 ? ROLE_ORDER.length : ai) - (bi === -1 ? ROLE_ORDER.length : bi);
  });

  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-[13px] font-extrabold tracking-[0.13em] text-neutral-50 uppercase">{t("currentRoster")}</h2>
        {members.length > 0 && (
          <span className="font-mono text-[11px] text-neutral-600">{t("rosterCount", { players, staff })}</span>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-neutral-500">{t("noRoster")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((m) => {
            const group = roleGroup(m.role);
            const style = GROUP_STYLES[group];
            const isInactive = m.inactiveSince != null;
            return (
              <Link
                key={m.personId}
                href={`/player/${m.personId}/${slugify(m.handle)}`}
                className="group flex overflow-hidden rounded-lg border border-neutral-800 bg-[var(--gcs-surface-2)] transition-colors hover:border-neutral-700"
              >
                {/* Only the accent bar goes gray for an inactive member — role badge keeps its normal color. */}
                <span className="w-1 flex-none" style={{ background: isInactive ? "var(--gcs-text-tertiary)" : style.bar }} />
                <div className="flex min-w-0 flex-1 items-center gap-3 p-3">
                  <span
                    className="flex h-10 w-10 flex-none items-center justify-center overflow-hidden rounded-lg border border-neutral-800"
                    style={{ background: `${style.badgeBg}` }}
                  >
                    {m.photoUrl || m.photoUrlLight ? (
                      <ThemedLogoImage
                        dark={m.photoUrl ?? m.photoUrlLight!}
                        light={m.photoUrlLight ?? m.photoUrl!}
                        alt={m.handle}
                        width={40}
                        height={40}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="text-base font-black" style={{ color: style.badgeText }}>
                        {m.handle.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-bold tracking-tight text-[var(--gcs-text)] group-hover:text-[#e4ae22]">
                      <CountryBadge code={m.countryCode} secondaryCode={m.secondaryCountryCode} />
                      {m.handle}
                    </p>
                    <div className="mt-1 flex min-w-0 items-center gap-2">
                      <span
                        className="flex-none rounded-sm px-1.5 py-0.5 font-mono text-[8px] font-black tracking-widest uppercase"
                        style={{ background: style.badgeBg, color: style.badgeText }}
                      >
                        {t(`role.${m.role}` as "role.player", { pronouns: m.pronouns ?? 2 })}
                      </span>
                      <span className="truncate font-mono text-[9px] font-bold text-neutral-500 uppercase tracking-widest">{displayMonthYear(m.since, t("unknownDate"))}</span>
                    </div>
                    {isInactive && (
                      <div className="mt-0.5 truncate font-mono text-[9px] font-bold text-neutral-600 uppercase tracking-widest">
                        {t("inactiveSince", { date: displayMonthYear(m.inactiveSince, t("unknownDate")) })}
                      </div>
                    )}
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

/**
 * GC-Stats - team-former-members
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { TeamFormerMember } from "@/lib/team-page-data";
import { displayMonthYear } from "@/lib/daterange";
import { slugify } from "@/lib/entity-id";
import { ThemedLogoImage } from "@/components/site/themed-logo-image";

// Same role grouping as `TeamRoster` (mirrors V1's RosterRole), but dimmed
// way down — former members should still read as gray/secondary at a glance,
// just with a faint hint of the role's color rather than the roster's vivid
// accent.
function mutedRoleColor(role: string): string {
  if (role === "player-igl" || role === "player") return "#9c8a5c";
  if (role === "sub") return "#6f95a8";
  if (role === "manager") return "#a4826a";
  return "#8c7f9e";
}

// The overview tab is a teaser, not the full list — anything beyond this is
// only reachable via the "Historique" link into the dedicated history page.
export const FORMER_MEMBERS_PREVIEW = 5;

/**
 * `limit` defaults to the 5-item overview teaser; pass `undefined` (via
 * `limit={null}`) from the full history page to render every former member.
 * `linkHref={null}` hides the "Historique" link — used on that same history
 * page, which is already where the link would go.
 */
export async function TeamFormerMembers({
  members,
  segment,
  limit = FORMER_MEMBERS_PREVIEW,
  linkHref,
}: {
  members: TeamFormerMember[];
  segment: string;
  limit?: number | null;
  linkHref?: string | null;
}) {
  const t = await getTranslations("teamPage");
  const shown = limit == null ? members : members.slice(0, limit);
  const historyHref = linkHref === null ? null : (linkHref ?? `/team/${segment}/history`);

  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-[13px] font-extrabold tracking-[0.13em] text-neutral-50 uppercase">{t("formerMembers")}</h2>
        <span className="flex-1" />
        {historyHref && (
          <Link href={historyHref} className="font-mono text-[11px] text-[#e4ae22] hover:underline">
            {t("history")}
          </Link>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-neutral-500">{t("noFormers")}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-800">
          {shown.map((m) => (
            <Link
              key={`${m.personId}-${m.role}-${m.since}`}
              href={`/player/${m.personId}/${slugify(m.handle)}`}
              className="grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-neutral-900 bg-[var(--gcs-surface-2)] p-2.5 transition-colors last:border-b-0 hover:bg-[var(--gcs-hover)]"
            >
              <span className="flex h-[30px] w-[30px] flex-none items-center justify-center overflow-hidden rounded-lg bg-white/[0.06] text-[13px] font-black text-neutral-400">
                {m.photoUrl || m.photoUrlLight ? (
                  <ThemedLogoImage
                    dark={m.photoUrl ?? m.photoUrlLight!}
                    light={m.photoUrlLight ?? m.photoUrl!}
                    alt={m.handle}
                    width={30}
                    height={30}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  m.handle.charAt(0).toUpperCase()
                )}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[13.5px] font-semibold text-neutral-100">{m.handle}</span>
                <span className="font-mono text-[9.5px] tracking-widest uppercase" style={{ color: mutedRoleColor(m.role) }}>
                  {t.has(`role.${m.role}` as "role.player") ? t(`role.${m.role}` as "role.player", { pronouns: m.pronouns ?? 2 }) : m.role}
                </span>
              </span>
              <span className="font-mono text-[10.5px] text-neutral-600">
                {displayMonthYear(m.since, t("unknownDate"))} – {displayMonthYear(m.until, t("unknownDate"))}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

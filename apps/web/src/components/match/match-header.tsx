/**
 * GC-Stats - match-header
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { GOLD, RED, tint } from "@/lib/theme-colors";
import { DEFAULT_TEAM_LOGO_DARK, DEFAULT_TEAM_LOGO_LIGHT } from "@/lib/default-logos";
import { slugify } from "@/lib/entity-id";
import type { MatchHeader as MatchHeaderData, MatchSide } from "@/lib/match-page-data";
import { FormattedDate } from "@/components/formatted-date";
import { ThemedLogoImage } from "@/components/site/themed-logo-image";
import { HeaderUtilityBar } from "@/components/site/header-utility-bar";
import { AdminPanelLink } from "@/components/site/admin-panel-link";
import { ShareMenuButton } from "@/components/site/share-menu-button";
import { isViewerAdmin } from "@/lib/rbac";

function TeamBlock({ side, name, align }: { side: MatchSide; name: string; align: "left" | "right" }) {
  const reversed = align === "right";
  const logo = (
    <div
      className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl border border-neutral-800 transition-transform duration-300 group-hover:scale-105 md:h-16 md:w-16"
      style={{ background: "var(--gcs-surface-2)" }}
    >
      <ThemedLogoImage
        dark={side.logoUrl ?? DEFAULT_TEAM_LOGO_DARK}
        light={side.logoUrlLight ?? side.logoUrl ?? DEFAULT_TEAM_LOGO_LIGHT}
        alt={name}
        width={56}
        height={56}
        className="h-9 w-9 object-contain md:h-11 md:w-11"
      />
    </div>
  );
  const label = (
    <h3 className="truncate pr-1 text-lg leading-none font-black tracking-tight text-[var(--gcs-text)] italic transition-colors group-hover:text-[#e4ae22] md:text-xl">{name}</h3>
  );

  const wrapperClass = `group flex min-w-0 flex-1 items-center gap-3 md:gap-4 ${reversed ? "flex-row-reverse justify-center md:justify-start" : "justify-center md:justify-end"}`;
  const content =
    align === "left" ? (
      <>
        <div className="min-w-0 text-center md:text-right">{label}</div>
        {logo}
      </>
    ) : (
      <>
        {logo}
        <div className="min-w-0 text-center md:text-left">{label}</div>
      </>
    );

  if (side.teamId && !side.isGhost) {
    return (
      <Link href={`/team/${side.teamId}/${slugify(name)}`} className={wrapperClass}>
        {content}
      </Link>
    );
  }
  return <div className={wrapperClass}>{content}</div>;
}

export async function MatchHeader({ match, children }: { match: MatchHeaderData; children?: ReactNode }) {
  const t = await getTranslations("matchPage");
  const tNav = await getTranslations("nav");
  const tShare = await getTranslations("share");
  const isAdmin = await isViewerAdmin();
  const teamAName = match.a.entrantId != null ? match.a.displayName : match.status === "completed" ? t("teamBye") : t("teamTbd");
  const teamBName = match.b.entrantId != null ? match.b.displayName : match.status === "completed" ? t("teamBye") : t("teamTbd");
  const live = match.status === "live";
  const finished = match.status === "completed";
  // -1 is the forfeit sentinel; when that side has no entrant at all it was
  // never a forfeit, it's an unfilled bracket slot (bye) auto-advancing the
  // other side.
  const sideLabel = (score: number | null, entrantId: number | null, fallback: number | string) =>
    score === -1 ? (entrantId == null ? "BYE" : "FF") : (score ?? fallback);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-neutral-800" style={{ background: "var(--gcs-surface-3)" }}>
      <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(560px 260px at 50% 0%, ${tint(GOLD, 0.1)}, transparent 65%)` }} />

      <HeaderUtilityBar>
        <ShareMenuButton
          items={[
            { href: `/match/${match.id}/liquipedia`, label: tShare("liquipediaWikicode"), icon: "match" },
            ...(match.tournamentIsGhost
              ? []
              : [
                  {
                    href: `/tournaments/${match.tournamentId}/${slugify(match.tournamentName)}/liquipedia?stage=${match.stageId}#match-${match.id}`,
                    label: tShare("tournamentWikicode"),
                    icon: "tournament" as const,
                  },
                ]),
          ]}
          calendarPath={match.tournamentIsGhost ? undefined : "/api/calendar/matches.ics"}
          posterMatchId={match.id}
        />
        {isAdmin && <AdminPanelLink href={`/admin/tournaments/${match.tournamentId}/matches/${match.id}`} label={tNav("adminPanel")} />}
      </HeaderUtilityBar>

      <div className="relative px-6 pt-14 pb-7 md:px-8 md:pt-6">
        <div className="mb-6 flex flex-col items-center gap-1 text-center">
          {match.tournamentIsGhost ? (
            <span className="max-w-full truncate font-mono text-[11px] font-bold tracking-widest text-neutral-300 uppercase">{match.tournamentName}</span>
          ) : (
            <Link
              href={`/tournaments/${match.tournamentId}/${slugify(match.tournamentName)}`}
              className="max-w-full truncate font-mono text-[11px] font-bold tracking-widest text-neutral-300 uppercase transition-colors hover:text-neutral-100"
            >
              {match.tournamentName}
            </Link>
          )}
          {/* The V1 migration flattened each phase's container into the phase itself (stage == container 1:1), so only the higher-level stage name (e.g. "Swiss", "Playoffs") is meaningful here, never the granular container/group name (e.g. "Group A"). */}
          <span className="font-mono text-[10px] text-neutral-600">{match.stageName}</span>
        </div>

        <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
          <TeamBlock side={match.a} name={teamAName} align="left" />

          <div className="flex flex-none flex-col items-center gap-2 px-2">
            {match.patch && <span className="mb-1 font-mono text-[10px] text-neutral-600">{t("patch", { patch: match.patch })}</span>}

            {live ? (
              <div className="flex flex-col items-center gap-1.5">
                <span className="flex items-center gap-1.5 rounded-md px-2.5 py-1" style={{ background: tint(RED, 0.14) }}>
                  <span className="h-1.5 w-1.5 flex-none animate-pulse rounded-full" style={{ background: RED }} />
                  <span className="text-[11px] font-black tracking-widest uppercase" style={{ color: RED }}>
                    {t("statusLive")}
                  </span>
                </span>
                <span className="font-mono text-2xl font-black tracking-tighter tabular-nums">
                  <span style={{ color: (match.scoreA ?? 0) > (match.scoreB ?? 0) ? GOLD : "var(--gcs-text)" }}>{sideLabel(match.scoreA, match.a.entrantId, 0)}</span>
                  <span className="mx-1.5 text-neutral-700">–</span>
                  <span style={{ color: (match.scoreB ?? 0) > (match.scoreA ?? 0) ? GOLD : "var(--gcs-text)" }}>{sideLabel(match.scoreB, match.b.entrantId, 0)}</span>
                </span>
              </div>
            ) : finished ? (
              <span className="font-mono text-3xl font-black tracking-tighter tabular-nums md:text-4xl">
                <span style={{ color: (match.scoreA ?? 0) > (match.scoreB ?? 0) ? GOLD : "var(--gcs-text)" }}>{sideLabel(match.scoreA, match.a.entrantId, "–")}</span>
                <span className="mx-2 text-neutral-700">–</span>
                <span style={{ color: (match.scoreB ?? 0) > (match.scoreA ?? 0) ? GOLD : "var(--gcs-text)" }}>{sideLabel(match.scoreB, match.b.entrantId, "–")}</span>
              </span>
            ) : (
              <span className="rounded-md bg-white/5 px-3 py-1.5 font-mono text-sm font-black tracking-widest text-neutral-300 uppercase">{t("vs")}</span>
            )}

            <span className="mt-1 font-mono text-[10px] text-neutral-600">{t("bestOf", { n: match.bestOf })}</span>

            {match.scheduledAt ? (
              <span className="mt-1 font-mono text-[11px] text-neutral-500">
                <FormattedDate date={match.scheduledAt} mode="date" /> · <FormattedDate date={match.scheduledAt} mode="time" />
              </span>
            ) : (
              <span className="mt-1 font-mono text-[11px] text-neutral-600 uppercase">{t("unknownDate")}</span>
            )}
          </div>

          <TeamBlock side={match.b} name={teamBName} align="right" />
        </div>

        {children}
      </div>
    </div>
  );
}

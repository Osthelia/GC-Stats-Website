/**
 * GC-Stats - match-scoreboard-header
 *
 * The top bar of a match scoreboard: both teams with their logos, and the score between them when one is given.
 * Shared by the Valorant and the LoL scoreboards.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import { DEFAULT_TEAM_LOGO_DARK, DEFAULT_TEAM_LOGO_LIGHT } from "@/lib/default-logos";
import type { MatchSide } from "@/lib/match-page-data";
import { ThemedLogoImage } from "@/components/site/themed-logo-image";

/** The winner's name and score are highlighted in the accent colour. */
const WINNER_CLASS = "text-[#e4ae22]";

export function MatchScoreboardHeader({
  a,
  b,
  teamAName,
  teamBName,
  scores,
  winner = null,
}: {
  a: MatchSide;
  b: MatchSide;
  teamAName: string;
  teamBName: string;
  scores?: { a: string; b: string };
  /** Which team won the game, when the header shows a game. */
  winner?: "a" | "b" | null;
}) {
  const t = useTranslations("matchPage");
  const logoA = a.logoUrl ?? DEFAULT_TEAM_LOGO_DARK;
  const logoALight = a.logoUrlLight ?? a.logoUrl ?? DEFAULT_TEAM_LOGO_LIGHT;
  const logoB = b.logoUrl ?? DEFAULT_TEAM_LOGO_DARK;
  const logoBLight = b.logoUrlLight ?? b.logoUrl ?? DEFAULT_TEAM_LOGO_LIGHT;

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-neutral-800 px-5 py-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-800" style={{ background: "var(--gcs-surface-2)" }}>
          <ThemedLogoImage dark={logoA} light={logoALight} alt={teamAName} width={28} height={28} className="h-6 w-6 object-contain" />
        </div>
        <span className={`truncate text-sm font-black italic ${winner === "a" ? WINNER_CLASS : "text-(--gcs-text)"}`}>{teamAName}</span>
      </div>
      <div className="flex shrink-0 items-center gap-3 px-2 font-mono text-[11px] font-bold tracking-[0.3em] uppercase">
        {scores && <span className={`text-sm ${winner === "a" ? WINNER_CLASS : "text-(--gcs-text)"}`}>{scores.a}</span>}
        <span className="text-neutral-600">{t("vs")}</span>
        {scores && <span className={`text-sm ${winner === "b" ? WINNER_CLASS : "text-(--gcs-text)"}`}>{scores.b}</span>}
      </div>
      <div className="flex min-w-0 items-center justify-end gap-2.5">
        <span className={`truncate text-sm font-black italic ${winner === "b" ? WINNER_CLASS : "text-(--gcs-text)"}`}>{teamBName}</span>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-800" style={{ background: "var(--gcs-surface-2)" }}>
          <ThemedLogoImage dark={logoB} light={logoBLight} alt={teamBName} width={28} height={28} className="h-6 w-6 object-contain" />
        </div>
      </div>
    </div>
  );
}

/**
 * GC-Stats - tournament-overview
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { GOLD } from "@/lib/home-fake-data";
import { TournamentBracketCanvasLazy } from "@/components/tournament/tournament-bracket-canvas-lazy";
import { TournamentStandingsTable } from "@/components/tournament/tournament-standings-table";
import { TournamentContainerTabs, type TournamentContainerTab } from "@/components/tournament/tournament-container-tabs";
import { TournamentFinalStandings } from "@/components/tournament/tournament-final-standings";
import { groupBracketContainers } from "@/lib/bracket-group-containers";
import type { PublicStage, PublicStageSummary } from "@/lib/tournament-bracket-data";

/** A stage's own explicit dates only (never derived from its matches) — mirrors V1's phase tab exactly (`d M` / `d M – d M Y`), just with our "→" instead of V1's en dash (CLAUDE.md: no dashes in text). Calendar dates, no time-of-day, so formatted in UTC to avoid a viewer-timezone shift landing on the wrong day. */
function formatStageDateRange(stage: Pick<PublicStage, "startDate" | "endDate">, locale: string): string | null {
  if (!stage.startDate && !stage.endDate) return null;
  const fmt = (iso: string, withYear: boolean) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: withYear ? "numeric" : undefined, timeZone: "UTC" }).format(new Date(iso));
  if (stage.startDate && stage.endDate) return `${fmt(stage.startDate, false)} → ${fmt(stage.endDate, true)}`;
  return fmt((stage.startDate ?? stage.endDate)!, true);
}

export async function TournamentOverview({ basePath, stages, activeStage }: { basePath: string; stages: PublicStageSummary[]; activeStage: PublicStage | null }) {
  const t = await getTranslations("tournamentPage");
  const locale = await getLocale();

  if (!activeStage) {
    return <p className="rounded-xl border border-dashed border-neutral-800 px-4 py-10 text-center text-sm text-neutral-500">{t("noStages")}</p>;
  }

  // All bracket-shaped containers of the stage (upper/lower/middle/grand
  // final...) render together in ONE canvas — a bracket-shaped container is
  // a swimlane WITHIN that canvas, not a separate box per container, so the
  // grand final visually continues the upper bracket's row instead of
  // floating disconnected below it. Every other container (standings groups,
  // or one with no matches yet) switches via TournamentContainerTabs instead
  // — order preserved from the stage's own container order.
  //
  // A stage can also hold several INDEPENDENT physical brackets (e.g. Group
  // A-H each running their own double-elim under one Open Qualifier stage) —
  // groupBracketContainers splits those apart so each gets its own canvas
  // instead of being merged into one giant unrelated mess (see that file's
  // docstring; bug report 2026-09-12, tournament 244).
  const graphContainers = activeStage.containers.filter((c) => c.graph && c.graph.matches.length > 0);
  const bracketGroups = groupBracketContainers(graphContainers);
  const tabContainers = activeStage.containers.filter((c) => !(c.graph && c.graph.matches.length > 0));
  const containerTabs: TournamentContainerTab[] = tabContainers.map((c) => ({
    id: c.id,
    name: c.name,
    content: c.standings ? (
      <TournamentStandingsTable standings={c.standings} showPoints={c.showPoints} qualificationRules={c.qualificationRules} />
    ) : (
      <p className="rounded-lg border border-dashed border-neutral-800 px-3 py-6 text-center text-xs text-neutral-500">{t("containerNotStarted")}</p>
    ),
  }));

  return (
    <div className="flex flex-col gap-6">
      {stages.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {stages.map((stage) => {
            const on = stage.id === activeStage.id;
            const dateRange = formatStageDateRange(stage, locale);
            return (
              <Link
                key={stage.id}
                href={{ pathname: `/tournaments/${basePath}`, query: { stage: stage.id } }}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] transition-all duration-200 active:scale-[0.96] ${on ? "" : "hover:-translate-y-0.5 hover:bg-white/[0.06]"}`}
                style={on ? { background: GOLD, color: "#0b0b0c", fontWeight: 700 } : { background: "var(--gcs-surface-3)", color: "var(--gcs-text-secondary)", fontWeight: 600, border: "1px solid #262626" }}
              >
                <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: on ? "#0b0b0c" : "#737373" }} />
                <span className="flex flex-col items-start">
                  {stage.name}
                  {dateRange && (
                    <span className="font-mono text-[10px] font-normal tracking-wide opacity-70">{dateRange}</span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {activeStage.containers.length === 0 && <p className="rounded-xl border border-dashed border-neutral-800 px-4 py-10 text-center text-sm text-neutral-500">{t("noContainers")}</p>}

      {graphContainers.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-neutral-800 p-4" style={{ background: "var(--gcs-surface-2)" }}>
          {/* Keyed by stage so switching stages remounts the canvas — React
              Flow's `fitView` only fits once on mount, not on later prop
              changes, so without this the bracket would stay framed for
              whichever stage was active first. */}
          {bracketGroups.length > 1 ? (
            <TournamentContainerTabs
              tabs={bracketGroups.map((g) => ({
                id: g.containers[0]!.id,
                name: g.label,
                content: <TournamentBracketCanvasLazy key={`${activeStage.id}-${g.key}`} containers={g.containers} tbdLabel={t("tbd")} />,
              }))}
            />
          ) : (
            <TournamentBracketCanvasLazy key={activeStage.id} containers={graphContainers} tbdLabel={t("tbd")} />
          )}
        </div>
      )}

      {containerTabs.length > 0 && <TournamentContainerTabs tabs={containerTabs} />}

      <TournamentFinalStandings rows={activeStage.finalStandings} />
    </div>
  );
}

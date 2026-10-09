/**
 * GC-Stats - bracket-viewer-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BracketViewerCanvas } from "@/components/admin/bracket-viewer/bracket-viewer-canvas";
import { BracketViewerBracketGroups } from "@/components/admin/bracket-viewer/bracket-viewer-bracket-groups";
import { BracketViewerGroupMatches } from "@/components/admin/bracket-viewer/bracket-viewer-group-matches";
import { BracketViewerFinalStandings } from "@/components/admin/bracket-viewer/bracket-viewer-final-standings";
import { groupBracketContainers } from "@/lib/bracket-group-containers";
import type { PublicStage } from "@/lib/tournament-bracket-data";

/**
 * Admin equivalent of the public site's TournamentOverview, for
 * `/admin/tournaments/{id}/bracket` — same stage-tab + bracket-canvas
 * structure. Kept separate from the public component per CLAUDE.md's
 * admin/public split.
 *
 * Group containers (Swiss, round-robin) never render in the bracket canvas
 * and never get a standings table here — only a conventional match list
 * (BracketViewerGroupMatches). Landed after two explicit corrections
 * (2026-09-14): first request was already "just a match list"; a
 * standings+list version got built and rejected ("Dégage completement
 * l'affichage robin/swiss"); removing the panel entirely also got rejected
 * ("Je t'ai dit de mettre UNIQUEMENT la liste des matchs") — so this is
 * specifically match-list-only, nothing more, nothing less.
 */
export async function BracketViewerPanel({
  tournamentId,
  stages,
  activeStageId,
  pagePath = "bracket",
  showEditorLink = true,
}: {
  tournamentId: number;
  stages: PublicStage[];
  activeStageId: number | null;
  /** Admin page segment the stage tabs link back to. */
  pagePath?: string;
  showEditorLink?: boolean;
}) {
  const t = await getTranslations("tournamentPage");
  const tViewer = await getTranslations("admin.tournaments.bracketViewerPage");

  const activeStage = stages.find((s) => s.id === activeStageId) ?? stages[0]!;
  const bracketContainers = activeStage.containers.filter((c) => c.containerType === "bracket");
  const groupContainers = activeStage.containers.filter((c) => c.containerType === "group");
  // Bracket-shaped containers of the stage render together in ONE canvas —
  // mirrors the public page's rule (a Grand Final continues the Upper
  // bracket's row visually instead of floating as its own box). A stage can
  // also hold several INDEPENDENT physical brackets (e.g. Group A-H each
  // running their own double-elim) — groupBracketContainers splits those
  // apart so each gets its own canvas/tab (see that file's docstring; bug
  // report 2026-09-12, tournament 244).
  const graphContainers = bracketContainers.filter((c) => c.graph && c.graph.matches.length > 0);
  const bracketGroups = groupBracketContainers(graphContainers);
  const emptyContainers = bracketContainers.filter((c) => !c.graph || c.graph.matches.length === 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {stages.length > 1 ? (
          <div className="flex flex-wrap gap-1.5">
            {stages.map((stage) => {
              const on = stage.id === activeStage.id;
              return (
                <Link
                  key={stage.id}
                  href={{ pathname: `/admin/tournaments/${tournamentId}/${pagePath}`, query: { stage: stage.id } }}
                  className={on ? "rounded-lg bg-primary px-3 py-1.5 text-[13px] font-bold text-primary-foreground" : "rounded-lg border bg-muted px-3 py-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground"}
                >
                  {stage.name}
                </Link>
              );
            })}
          </div>
        ) : (
          <span />
        )}

        {showEditorLink && (
          <Link href={`/admin/tournaments/${tournamentId}/stages/${activeStage.id}/editor`} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
            {tViewer("openInEditor")}
          </Link>
        )}
      </div>

      {activeStage.containers.length === 0 && <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">{t("noContainers")}</p>}

      {graphContainers.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border p-4">
          {bracketGroups.length > 1 ? (
            <BracketViewerBracketGroups tournamentId={tournamentId} groups={bracketGroups} tbdLabel={t("tbd")} />
          ) : (
            <BracketViewerCanvas tournamentId={tournamentId} containers={graphContainers} tbdLabel={t("tbd")} />
          )}
        </div>
      )}

      {groupContainers.length > 0 && <BracketViewerGroupMatches tournamentId={tournamentId} containers={groupContainers} />}

      {emptyContainers.length > 0 && (
        <div className="flex flex-col gap-4">
          {emptyContainers.map((container) => (
            <div key={container.id} className="rounded-xl border p-4">
              <h2 className="text-[13.5px] font-bold tracking-tight">{container.name}</h2>
              <p className="mt-3 rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">{t("containerNotStarted")}</p>
            </div>
          ))}
        </div>
      )}

      <BracketViewerFinalStandings tournamentId={tournamentId} rows={activeStage.finalStandings} />
    </div>
  );
}

/**
 * GC-Stats - tournament-bracket-data
 *
 * Public tournament page data: header info, stage links, and the bracket
 * graph/standings/final placements per stage, built by reusing the admin
 * bracket editor's own data hydration rather than duplicating the query.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { cache } from "react";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { tournaments, teams, stages } from "@gc-stats/db";
import { visibleTournament } from "@/lib/ghost-visibility";
import { listTournamentStages, type AdminContainerRow } from "@/lib/admin-tournament-detail";
import { getStageEditorData, type EditorMatch, type EditorEdge } from "@/lib/admin-bracket-editor-data";
import { computeContainerStandings, type GroupStandingsEntry } from "@/lib/bracket/standings";
import { getContainerAdvancementRules } from "@/lib/bracket/container-qualifications";
import { getStageFinalStandings } from "@/lib/bracket/final-standings";
import { parseGroupConfig, isPointsConfigActive } from "@/lib/bracket/config-types";
import { getCurrentLogoUrlsThemed } from "@/lib/admin-logos";
import { slugify } from "@/lib/entity-id";

export type TournamentHeaderInfo = {
  id: number;
  name: string;
  logoUrl: string | null;
  logoUrlLight: string | null;
  region: string | null;
  category: string | null;
  startDate: string;
  endDate: string;
  status: string;
  location: string | null;
  prizePool: string | null;
  description: string | null;
  liquipediaLink: string | null;
  socials: Record<string, string>;
  playerPovPhrase: string | null;
};

/** Deduplicated per request (page, header and metadata can all ask for it). */
export const getPublicTournamentHeader = cache(async (id: number): Promise<TournamentHeaderInfo | null> => {
  const [[row], logosByTournamentId] = await Promise.all([
    db
      .select({
        id: tournaments.id,
        name: tournaments.name,
        region: tournaments.region,
        category: tournaments.category,
        startDate: tournaments.startDate,
        endDate: tournaments.endDate,
        status: tournaments.status,
        location: tournaments.location,
        prizePool: tournaments.prizePool,
        description: tournaments.description,
        liquipediaLink: tournaments.liquipediaLink,
        socials: tournaments.socials,
        playerPovPhrase: tournaments.playerPovPhrase,
      })
      .from(tournaments)
      .where(and(eq(tournaments.id, id), visibleTournament)),
    getCurrentLogoUrlsThemed("tournament", [id]),
  ]);
  if (!row) return null;
  return {
    ...row,
    socials: (row.socials as Record<string, string>) ?? {},
    logoUrl: logosByTournamentId.get(id)?.dark ?? null,
    logoUrlLight: logosByTournamentId.get(id)?.light ?? null,
  };
});

export type PublicStageLink = { name: string; liquipediaLink: string };

/** Every active stage's Liquipedia link, for the header pills — shown on every tournament tab at all times, not just the currently viewed stage. */
export async function getPublicTournamentStageLinks(tournamentId: number): Promise<PublicStageLink[]> {
  const rows = await db
    .select({ name: stages.name, liquipediaLink: stages.liquipediaLink })
    .from(stages)
    .where(and(eq(stages.tournamentId, tournamentId), eq(stages.active, true)))
    .orderBy(asc(stages.sequenceOrder), asc(stages.id));
  return rows.filter((r): r is { name: string; liquipediaLink: string } => Boolean(r.liquipediaLink));
}

export type PublicBracketMatch = EditorMatch & {
  entrantAName: string | null;
  entrantBName: string | null;
};

export type PublicStandingsRow = GroupStandingsEntry & { displayName: string; teamHref: string | null };

export type PublicQualificationRule = { rankFrom: number; rankTo: number; label: string; url: string };

export type PublicFinalStandingRow = {
  qualificationId: number;
  placement: number;
  placementLabel: string;
  points: number | null;
  cashPrizeAmount: string | null;
  cashPrizeCurrency: string | null;
  entrantId: number;
  displayName: string;
  shortName: string | null;
  teamHref: string | null;
  logoUrl: string | null;
  logoUrlLight: string | null;
};

export type PublicStageContainer = AdminContainerRow & {
  /** Present for bracket-shaped containers (bracket, or a group in round-robin format — both render as a graph). */
  graph?: { matches: PublicBracketMatch[]; edges: EditorEdge[] };
  /** Present for group containers — ranked standings regardless of shape. */
  standings?: PublicStandingsRow[];
  /** Present for group containers (Swiss and round-robin alike) — resolved matches for the admin bracket viewer's match-list-only display (never a graph, never standings, on that page specifically). */
  matches?: PublicBracketMatch[];
  /** Whether this container has an active points tiebreaker configured — the standings table only shows the Points column when true. */
  showPoints?: boolean;
  /** Rank-based advancement rules for this container (empty when none configured) — drives the standings table's qualification indicator + legend, mirrors V1. */
  qualificationRules?: PublicQualificationRule[];
};

export type PublicStage = {
  id: number;
  name: string;
  sequenceOrder: number;
  status: "pending" | "active" | "completed";
  /** Explicit admin-set scheduling window (mirrors V1's phase dates), not derived from matches — see AdminStageRow. */
  startDate: string | null;
  endDate: string | null;
  liquipediaLink: string | null;
  containers: PublicStageContainer[];
  /** Final placements this stage's qualification rules resolved to (empty until a match/group carrying a placement rule actually finishes) — see getStageFinalStandings. */
  finalStandings: PublicFinalStandingRow[];
};

/**
 * Reuses the admin bracket editor's own data hydration (`getStageEditorData`)
 * for the graph shape — the public page needs exactly the same
 * matches+edges, just enriched with entrant display names and (for group
 * containers) ranked standings, rather than duplicating the query.
 */
/** A stage as listed in the stage pills, without its bracket. */
export type PublicStageSummary = Omit<PublicStage, "containers" | "finalStandings">;

/** Every public stage for the pills, but only the displayed one (`activeStageId`, else the first) gets its bracket built. */
export async function getPublicTournamentStages(
  tournamentId: number,
  activeStageId: number | null,
): Promise<{ stages: PublicStageSummary[]; activeStage: PublicStage | null }> {
  // The active toggle is a public-visibility switch only — the admin
  // bracket viewer (getAdminTournamentStages) shows every stage regardless.
  const stages = (await listTournamentStages(tournamentId)).filter((s) => s.active);
  const active = stages.find((s) => s.id === activeStageId) ?? stages[0];
  return {
    stages: stages.map((s) => ({ id: s.id, name: s.name, sequenceOrder: s.sequenceOrder, status: s.status, startDate: s.startDate, endDate: s.endDate, liquipediaLink: s.liquipediaLink })),
    activeStage: active ? await buildStageView(active) : null,
  };
}

/**
 * Same shape as `getPublicTournamentStages`, but for the admin bracket
 * viewer (`/admin/tournaments/{id}/bracket`) — every stage regardless of its
 * public "active" toggle, mirroring how the rest of admin (stage list,
 * editor) never hides inactive stages (SUIVI.md: "ne bloque jamais l'admin").
 */
export async function getAdminTournamentStages(tournamentId: number): Promise<PublicStage[]> {
  const stages = await listTournamentStages(tournamentId);
  return buildStagesView(stages);
}

async function buildStageView(stage: Awaited<ReturnType<typeof listTournamentStages>>[number]): Promise<PublicStage> {
  const editorData = await getStageEditorData(stage.id);
  const entrantNameById = new Map(editorData?.entrants.map((e) => [e.id, e.displayName]) ?? []);
  const entrantTeamIdById = new Map(editorData?.entrants.map((e) => [e.id, e.teamId]) ?? []);

  const finalStandingsPromise = getStageFinalStandings(db, stage.id);
  const containers: PublicStageContainer[] = await Promise.all(
    stage.containers.map(async (container) => {
      const isGroup = container.containerType === "group";

      const containerMatches = (editorData?.matches ?? []).filter((m) => m.containerId === container.id);
      const resolvedMatches: PublicBracketMatch[] = containerMatches.map((m) => ({
        ...m,
        entrantAName: m.entrantAId !== null ? (entrantNameById.get(m.entrantAId) ?? null) : null,
        entrantBName: m.entrantBId !== null ? (entrantNameById.get(m.entrantBId) ?? null) : null,
      }));

      // Group containers (Swiss and round-robin alike) never render in the
      // bracket-canvas graph — round-robin used to (as a grid of match
      // nodes), but that read poorly as a "bracket". They only ever show
      // via `matches` (admin bracket viewer's match-list-only display) and
      // `standings` (public tournament page) below.
      let graph: PublicStageContainer["graph"];
      if (!isGroup) {
        const containerEdges = (editorData?.edges ?? []).filter((e) => containerMatches.some((m) => m.id === e.fromMatchId));
        graph = { matches: resolvedMatches, edges: containerEdges };
      }
      const matches: PublicStageContainer["matches"] = isGroup ? resolvedMatches : undefined;

      let standings: PublicStageContainer["standings"];
      let showPoints = false;
      let qualificationRules: PublicStageContainer["qualificationRules"];
      if (isGroup) {
        const [ranked, advancementRules] = await Promise.all([
          computeContainerStandings(db, container.id, container.config),
          getContainerAdvancementRules(db, container.id),
        ]);
        standings = ranked.map((r) => {
          const displayName = entrantNameById.get(Number(r.id)) ?? `#${r.id}`;
          const teamId = entrantTeamIdById.get(Number(r.id)) ?? null;
          return { ...r, displayName, teamHref: teamId !== null ? `/team/${teamId}/${slugify(displayName)}` : null };
        });
        showPoints = isPointsConfigActive(parseGroupConfig(container.config).pointsConfig);
        qualificationRules = advancementRules.map((r) => ({
          rankFrom: r.rankFrom,
          rankTo: r.rankTo,
          label: `${r.destinationTournamentName} · ${r.destinationContainerName}`,
          url: `/tournaments/${r.destinationTournamentId}/${slugify(r.destinationTournamentName)}?stage=${r.destinationStageId}`,
        }));
      }

      return { ...container, graph, matches, standings, showPoints, qualificationRules };
    }),
  );

  const finalStandingsRaw = await finalStandingsPromise;
  const finalStandingTeamIds = [...new Set(finalStandingsRaw.map((r) => entrantTeamIdById.get(r.entrantId) ?? null).filter((id): id is number => id !== null))];
  const [finalStandingLogos, finalStandingTeamRows] = await Promise.all([
    finalStandingTeamIds.length ? getCurrentLogoUrlsThemed("team", finalStandingTeamIds) : Promise.resolve(new Map()),
    finalStandingTeamIds.length ? db.select({ id: teams.id, shortName: teams.shortName }).from(teams).where(inArray(teams.id, finalStandingTeamIds)) : Promise.resolve([]),
  ]);
  const shortNameByTeamId = new Map(finalStandingTeamRows.map((t) => [t.id, t.shortName]));
  const finalStandings: PublicFinalStandingRow[] = finalStandingsRaw.map((r) => {
    const displayName = entrantNameById.get(r.entrantId) ?? `#${r.entrantId}`;
    const teamId = entrantTeamIdById.get(r.entrantId) ?? null;
    const logos = teamId !== null ? finalStandingLogos.get(teamId) : null;
    return {
      qualificationId: r.qualificationId,
      placement: r.placement!,
      placementLabel: r.placementLabel,
      points: r.points,
      cashPrizeAmount: r.cashPrizeAmount,
      cashPrizeCurrency: r.cashPrizeCurrency,
      entrantId: r.entrantId,
      displayName,
      shortName: teamId !== null ? (shortNameByTeamId.get(teamId) ?? null) : null,
      teamHref: teamId !== null ? `/team/${teamId}/${slugify(displayName)}` : null,
      logoUrl: logos?.dark ?? null,
      logoUrlLight: logos?.light ?? null,
    };
  });

  return { id: stage.id, name: stage.name, sequenceOrder: stage.sequenceOrder, status: stage.status, startDate: stage.startDate, endDate: stage.endDate, liquipediaLink: stage.liquipediaLink, containers, finalStandings };
}

async function buildStagesView(stages: Awaited<ReturnType<typeof listTournamentStages>>): Promise<PublicStage[]> {
  if (stages.length === 0) return [];
  return Promise.all(stages.map(buildStageView));
}

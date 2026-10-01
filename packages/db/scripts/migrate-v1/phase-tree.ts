/**
 * GC-Stats — phase-tree
 *
 * Shared resolver for V1's tournament_phases parent_id tree into V2's
 * 2-level stage/stage_container model. Used by both the forward migration
 * (04-tournaments.ts::migrateStages) and the one-off repair of already
 * migrated tournaments (repair-stage-hierarchy.ts); the two must never
 * diverge or they'd produce different structures for the same V1 data.
 *
 * A phase is usually either a pure grouping node or a leaf with matches,
 * but a few have both (handled by giving that phase's own matches their
 * own container in addition to descending into its children). Nesting goes
 * up to 3 levels deep: only the top-level phase becomes a `stage`, every
 * descendant with matches becomes a `stage_container` directly under it,
 * named by joining the ancestor chain.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export interface V1Phase {
  id: number;
  parent_id: number | null;
  tournament_id: number;
  name: string;
  format: string | null;
  order: number | null;
}

export interface ContainerPlan {
  /** The V1 phase id whose own matches this container holds. */
  leafPhaseId: number;
  /** The V1 phase id of the top-level ancestor — this container's stage. */
  stagePhaseId: number;
  tournamentId: number;
  /** Display name: ancestor names (excl. the stage itself) + the leaf's own name. */
  name: string;
  isGroup: boolean; // round_robin | swiss
  format: string | null;
}

export interface StagePlan {
  phaseId: number;
  tournamentId: number;
  name: string;
  order: number;
}

export interface PhaseTreePlan {
  stages: StagePlan[];
  containers: ContainerPlan[];
}

/**
 * @param phases every row of tournament_phases (all tournaments at once is fine).
 * @param phaseIdsWithMatches set of phase ids that have at least one row in `matches`.
 */
export function resolvePhaseTree(phases: V1Phase[], phaseIdsWithMatches: Set<number>): PhaseTreePlan {
  const byId = new Map<number, V1Phase>(phases.map((p) => [p.id, p]));
  const childrenOf = new Map<number, V1Phase[]>();
  for (const p of phases) {
    if (p.parent_id == null) continue;
    if (!childrenOf.has(p.parent_id)) childrenOf.set(p.parent_id, []);
    childrenOf.get(p.parent_id)!.push(p);
  }

  const stages: StagePlan[] = [];
  const containers: ContainerPlan[] = [];

  const topPhases = phases.filter((p) => p.parent_id == null);
  for (const stagePhase of topPhases) {
    stages.push({
      phaseId: stagePhase.id,
      tournamentId: stagePhase.tournament_id,
      name: stagePhase.name,
      order: stagePhase.order ?? 1,
    });

    // DFS from the stage, collecting one container per descendant (or the
    // stage itself) that has matches of its own — `namePath` accumulates
    // ancestor names strictly below the stage.
    const stack: { phase: V1Phase; namePath: string[] }[] = [{ phase: stagePhase, namePath: [] }];
    while (stack.length > 0) {
      const { phase, namePath } = stack.pop()!;
      const kids = childrenOf.get(phase.id) ?? [];
      if (phaseIdsWithMatches.has(phase.id)) {
        // A phase with both own matches and children (rare, 4/917 rows —
        // e.g. a "Main Event" phase holding a direct "Grand Final" match
        // alongside "Upper Bracket"/"Lower Bracket" children) would
        // otherwise get a container named identically to its own stage —
        // disambiguate rather than emit two same-named rows.
        const name = namePath.length > 0
          ? namePath.join(" - ")
          : kids.length > 0 ? `${phase.name} - Additional Matches` : phase.name;
        containers.push({
          leafPhaseId: phase.id,
          stagePhaseId: stagePhase.id,
          tournamentId: stagePhase.tournament_id,
          name,
          isGroup: phase.format === "round_robin" || phase.format === "swiss" || phase.format === "swiss_buchholz",
          format: phase.format,
        });
      }
      for (const kid of kids) {
        stack.push({ phase: kid, namePath: [...namePath, kid.name] });
      }
    }
  }

  return { stages, containers };
}

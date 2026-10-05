/**
 * GC-Stats - admin-bracket-qualifications
 *
 * Admin server actions for stage qualification rules: which entrants
 * advance from a source (rank range or match outcome) to a destination
 * container or final placement.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { stageQualifications, stageContainers, matches, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";
import { searchQualificationDestinationContainers as searchDestinationContainersQuery, type QualificationContainerSearchResult } from "@/lib/admin-bracket-qualifications";
import { resolveContainerRankQualifications, resolveContainerMatchQualifications } from "@/lib/bracket/qualification-resolution";
import type { Tx } from "@/lib/bracket/repository";

async function requireTournamentsActor(): Promise<void> {
  await requireActorPermission(PERMISSIONS.tournamentsManage);
}

export async function searchQualificationDestinationContainers(query: string): Promise<QualificationContainerSearchResult[]> {
  await requireActorPermission(PERMISSIONS.tournamentsView);
  return searchDestinationContainersQuery(query);
}

export type QualificationRuleField =
  | "sourceContainerId"
  | "rankFrom"
  | "rankTo"
  | "sourceMatchId"
  | "outcome"
  | "destinationContainerId"
  | "placement"
  | "placementLabel"
  | "points"
  | "cashPrizeAmount"
  | "cashPrizeCurrency"
  | "general";
export type QualificationRuleFieldErrors = Partial<Record<QualificationRuleField, string>>;
export type QualificationRuleResult = { ok: true; id: number } | { ok: false; fieldErrors: QualificationRuleFieldErrors };

export type QualificationRuleInput = {
  sourceKind: "rank" | "match";
  sourceContainerId: number | null;
  rankFrom: string;
  rankTo: string;
  sourceMatchId: number | null;
  outcome: "winner" | "loser" | null;
  destinationKind: "container" | "placement";
  destinationContainerId: number | null;
  placement: string;
  placementLabel: string;
  points: string;
  cashPrizeAmount: string;
  cashPrizeCurrency: string;
};

type ValidatedRule = {
  sourceContainerId: number | null;
  rankFrom: number | null;
  rankTo: number | null;
  sourceMatchId: number | null;
  outcome: "winner" | "loser" | null;
  destinationType: "container" | "placement";
  destinationContainerId: number | null;
  placement: number | null;
  placementLabel: string | null;
  points: number | null;
  cashPrizeAmount: string | null;
  cashPrizeCurrency: string | null;
};

async function validateRule(input: QualificationRuleInput): Promise<{ fieldErrors: QualificationRuleFieldErrors } | { value: ValidatedRule }> {
  const fieldErrors: QualificationRuleFieldErrors = {};

  let sourceContainerId: number | null = null;
  let rankFrom: number | null = null;
  let rankTo: number | null = null;
  let sourceMatchId: number | null = null;
  let outcome: "winner" | "loser" | null = null;
  /** The containerId a "can't qualify into itself" check compares the destination against. */
  let sourceContainerIdForSelfCheck: number | null = null;

  if (input.sourceKind === "rank") {
    if (input.sourceContainerId === null) {
      fieldErrors.sourceContainerId = "required";
    } else {
      const [container] = await db.select().from(stageContainers).where(eq(stageContainers.id, input.sourceContainerId));
      if (!container) fieldErrors.sourceContainerId = "notFound";
      else if (container.containerType !== "group") fieldErrors.sourceContainerId = "mustBeGroupContainer";
      else {
        sourceContainerId = container.id;
        sourceContainerIdForSelfCheck = container.id;
      }
    }

    const parsedFrom = Number(input.rankFrom);
    if (!input.rankFrom || !Number.isInteger(parsedFrom) || parsedFrom < 1) fieldErrors.rankFrom = "invalid";
    else rankFrom = parsedFrom;

    const parsedTo = Number(input.rankTo);
    if (!input.rankTo || !Number.isInteger(parsedTo) || parsedTo < 1) fieldErrors.rankTo = "invalid";
    else if (rankFrom !== null && parsedTo < rankFrom) fieldErrors.rankTo = "mustBeAfterRankFrom";
    else rankTo = parsedTo;
  } else {
    if (input.sourceMatchId === null) {
      fieldErrors.sourceMatchId = "required";
    } else {
      const [match] = await db.select().from(matches).where(eq(matches.id, input.sourceMatchId));
      if (!match) fieldErrors.sourceMatchId = "notFound";
      else {
        sourceMatchId = match.id;
        sourceContainerIdForSelfCheck = match.containerId;
      }
    }
    if (input.outcome !== "winner" && input.outcome !== "loser") fieldErrors.outcome = "required";
    else outcome = input.outcome;
  }

  let destinationContainerId: number | null = null;
  let placement: number | null = null;
  let placementLabel: string | null = null;
  let points: number | null = null;
  let cashPrizeAmount: string | null = null;
  let cashPrizeCurrency: string | null = null;

  if (input.destinationKind === "container") {
    if (input.destinationContainerId === null) {
      fieldErrors.destinationContainerId = "required";
    } else if (sourceContainerIdForSelfCheck !== null && input.destinationContainerId === sourceContainerIdForSelfCheck) {
      fieldErrors.destinationContainerId = "selfQualification";
    } else {
      const [dest] = await db.select().from(stageContainers).where(eq(stageContainers.id, input.destinationContainerId));
      if (!dest) fieldErrors.destinationContainerId = "notFound";
      else destinationContainerId = dest.id;
    }
  } else {
    const parsedPlacement = Number(input.placement);
    if (!input.placement || !Number.isInteger(parsedPlacement) || parsedPlacement < 1) fieldErrors.placement = "invalid";
    else placement = parsedPlacement;

    const trimmedLabel = input.placementLabel.trim();
    if (!trimmedLabel) fieldErrors.placementLabel = "required";
    else if (trimmedLabel.length > 50) fieldErrors.placementLabel = "tooLong";
    else placementLabel = trimmedLabel;

    if (input.points.trim()) {
      const parsedPoints = Number(input.points);
      if (!Number.isInteger(parsedPoints) || parsedPoints < 0) fieldErrors.points = "invalid";
      else points = parsedPoints;
    }

    if (input.cashPrizeAmount.trim()) {
      const parsedAmount = Number(input.cashPrizeAmount);
      if (!Number.isFinite(parsedAmount) || parsedAmount < 0) fieldErrors.cashPrizeAmount = "invalid";
      else cashPrizeAmount = parsedAmount.toFixed(2);

      const trimmedCurrency = input.cashPrizeCurrency.trim();
      if (!trimmedCurrency) fieldErrors.cashPrizeCurrency = "required";
      else if (trimmedCurrency.length > 8) fieldErrors.cashPrizeCurrency = "tooLong";
      else cashPrizeCurrency = trimmedCurrency;
    }
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  return {
    value: {
      sourceContainerId,
      rankFrom,
      rankTo,
      sourceMatchId,
      outcome,
      destinationType: input.destinationKind,
      destinationContainerId,
      placement,
      placementLabel,
      points,
      cashPrizeAmount,
      cashPrizeCurrency,
    },
  };
}

/**
 * A rule is normally resolved the moment its source container/match
 * finishes (`match-resolution-service.ts::completeContainer`) — but that
 * event has already happened for a rule added retroactively onto an
 * already-completed stage (the primary use case here: configuring a
 * tournament's final standings after the fact). Re-running the same
 * resolution functions is safe either way — `qualificationResults` inserts
 * are `onConflictDoNothing` and `fillMatchSlotFromSeed` never overwrites a
 * slot that already holds a team.
 */
async function resolveIfSourceAlreadyDecided(tx: Tx, value: { sourceContainerId: number | null; sourceMatchId: number | null }): Promise<void> {
  if (value.sourceContainerId !== null) {
    const [container] = await tx.select().from(stageContainers).where(eq(stageContainers.id, value.sourceContainerId));
    if (container && container.status === "completed") await resolveContainerRankQualifications(tx, container);
  } else if (value.sourceMatchId !== null) {
    const [match] = await tx.select().from(matches).where(eq(matches.id, value.sourceMatchId));
    if (match && match.status === "completed") await resolveContainerMatchQualifications(tx, match.containerId);
  }
}

export async function createQualificationRule(input: QualificationRuleInput): Promise<QualificationRuleResult> {
  await requireTournamentsActor();

  const validated = await validateRule(input);
  if ("fieldErrors" in validated) return { ok: false, fieldErrors: validated.fieldErrors };

  return db.transaction(async (tx) => {
    const [row] = await tx.insert(stageQualifications).values(validated.value).returning({ id: stageQualifications.id });
    await resolveIfSourceAlreadyDecided(tx, validated.value);
    return { ok: true, id: row!.id };
  });
}

export async function updateQualificationRule(id: number, input: QualificationRuleInput): Promise<QualificationRuleResult> {
  await requireTournamentsActor();

  const [existing] = await db.select().from(stageQualifications).where(eq(stageQualifications.id, id));
  if (!existing) return { ok: false, fieldErrors: { general: "notFound" } };

  const validated = await validateRule(input);
  if ("fieldErrors" in validated) return { ok: false, fieldErrors: validated.fieldErrors };

  await db.transaction(async (tx) => {
    await tx.update(stageQualifications).set(validated.value).where(eq(stageQualifications.id, id));
    await resolveIfSourceAlreadyDecided(tx, validated.value);
  });
  return { ok: true, id };
}

export type DeleteQualificationRuleResult = { ok: true } | { ok: false; error: string };

export async function deleteQualificationRule(id: number): Promise<DeleteQualificationRuleResult> {
  await requireTournamentsActor();

  const [existing] = await db.select().from(stageQualifications).where(eq(stageQualifications.id, id));
  if (!existing) return { ok: false, error: "notFound" };

  await db.delete(stageQualifications).where(eq(stageQualifications.id, id));
  return { ok: true };
}

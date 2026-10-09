/**
 * GC-Stats - logo-trace
 *
 * Step by step trace of logo upload actions, kept in the activity log (one
 * entry per upload, updated at every step) and in the console, to locate where
 * an upload dies. The entry is written as soon as the entity is known, so a
 * request that dies midway still leaves its last reached step behind.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq } from "drizzle-orm";
import { adminDb } from "@gc-stats/db/client";
import { activityLog } from "@gc-stats/db";
import type { LogoEntityType } from "@/lib/admin-logos";
import type { ActivitySubject } from "@/lib/activity-log";

export type LogoTrace = {
  step: (name: string, details?: Record<string, unknown>) => void;
  /** Logs the shape of the uploaded file (never its content). */
  file: (value: FormDataEntryValue | null) => void;
  /** Attaches the trace to the entity it concerns, which creates its activity log entry. */
  subject: (subject: ActivitySubject, subjectId: number, actorUserId: string) => void;
};

type TraceStep = { step: string; atMs: number; details?: Record<string, unknown> };
type TraceStatus = "running" | "ok" | "rejected" | "threw";

/** Logo entity types tracked in the activity log (news authors are not). */
export function activitySubjectForLogo(entityType: LogoEntityType): ActivitySubject | null {
  if (entityType === "team") return "team";
  if (entityType === "person") return "player";
  if (entityType === "organization") return "organization";
  if (entityType === "tournament") return "tournament";
  return null;
}

function describeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return { value: String(error) };
  return { name: error.name, message: error.message, cause: error.cause instanceof Error ? error.cause.message : error.cause, stack: error.stack };
}

/** Next's redirect()/forbidden()/notFound() are thrown on purpose and carry a `NEXT_` digest, they are not failures. */
function isNextControlFlow(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}

/** Runs the action while recording every step. The action's result or error is returned/rethrown unchanged, and a failing trace write never affects it. */
export async function withLogoTrace<T>(label: string, fn: (trace: LogoTrace) => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  const steps: TraceStep[] = [];
  let status: TraceStatus = "running";
  let error: Record<string, unknown> | null = null;
  let target: { subject: ActivitySubject; subjectId: number; actorUserId: string } | null = null;
  let entryId: number | null = null;

  // Writes are chained so they stay ordered, and swallow their own failures.
  let writes: Promise<void> = Promise.resolve();
  const properties = () => ({ section: "logo-trace", label, status, durationMs: Date.now() - startedAt, steps, error, actorUserId: target?.actorUserId ?? null });
  const persist = () => {
    if (!target) return;
    writes = writes.then(async () => {
      try {
        if (entryId === null) {
          const [row] = await adminDb
            .insert(activityLog)
            .values({
              logName: target!.subject,
              description: `Logo upload trace: ${label}`,
              subjectType: target!.subject,
              subjectId: String(target!.subjectId),
              event: "updated",
              properties: properties(),
            })
            .returning({ id: activityLog.id });
          entryId = row?.id ?? null;
        } else {
          await adminDb.update(activityLog).set({ properties: properties() }).where(eq(activityLog.id, entryId));
        }
      } catch (writeError) {
        console.error(`[logo-trace] ${label} could not write the activity log entry`, describeError(writeError));
      }
    });
  };

  const record = (step: string, details?: Record<string, unknown>) => {
    const atMs = Date.now() - startedAt;
    steps.push({ step, atMs, ...(details ? { details } : {}) });
    console.log(`[logo-trace] ${label} ${step} (+${atMs}ms)`, details ?? "");
    persist();
  };

  const trace: LogoTrace = {
    step: record,
    file: (value) => {
      if (value instanceof File) record("file", { name: value.name, type: value.type, size: value.size });
      else record("file", { present: false, kind: typeof value });
    },
    subject: (subject, subjectId, actorUserId) => {
      target = { subject, subjectId, actorUserId };
      persist();
    },
  };

  record("start");
  try {
    const result = await fn(trace);
    const ok = typeof result === "object" && result !== null && "ok" in result ? Boolean((result as { ok: unknown }).ok) : true;
    status = ok ? "ok" : "rejected";
    record("done", { ok });
    await writes;
    return result;
  } catch (thrown) {
    if (!isNextControlFlow(thrown)) {
      status = "threw";
      error = describeError(thrown);
      console.error(`[logo-trace] ${label} threw (+${Date.now() - startedAt}ms)`, error);
      persist();
    }
    await writes;
    throw thrown;
  }
}

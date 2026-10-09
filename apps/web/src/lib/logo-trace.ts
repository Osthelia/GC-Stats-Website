/**
 * GC-Stats - logo-trace
 *
 * Step by step logging for logo upload actions, to locate where an upload dies
 * (the runtime reports a bare 500 otherwise). Every line starts with
 * `[logo-trace]` so it can be filtered in the logs.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export type LogoTrace = {
  step: (name: string, details?: Record<string, unknown>) => void;
  /** Logs the shape of the uploaded file (never its content). */
  file: (value: FormDataEntryValue | null) => void;
};

function describeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return { value: String(error) };
  return { name: error.name, message: error.message, cause: error.cause instanceof Error ? error.cause.message : error.cause, stack: error.stack };
}

/** Next's redirect()/forbidden()/notFound() are thrown on purpose and carry a `NEXT_` digest, they are not failures. */
function isNextControlFlow(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}

/** Logs start, each step with elapsed time, and the full error (then rethrows it unchanged) if the action throws. */
export async function withLogoTrace<T>(label: string, fn: (trace: LogoTrace) => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  const log = (message: string, details?: unknown) => console.log(`[logo-trace] ${label} ${message} (+${Date.now() - startedAt}ms)`, details ?? "");

  log("start");
  const trace: LogoTrace = {
    step: (name, details) => log(name, details),
    file: (value) => {
      if (value instanceof File) log("file", { name: value.name, type: value.type, size: value.size });
      else log("file", { present: false, kind: typeof value });
    },
  };

  try {
    const result = await fn(trace);
    log("done", typeof result === "object" && result !== null && "ok" in result ? { ok: (result as { ok: boolean }).ok } : undefined);
    return result;
  } catch (error) {
    if (!isNextControlFlow(error)) console.error(`[logo-trace] ${label} threw (+${Date.now() - startedAt}ms)`, describeError(error));
    throw error;
  }
}

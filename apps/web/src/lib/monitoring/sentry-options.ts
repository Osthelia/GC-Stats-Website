/**
 * GC-Stats - Error tracking options
 *
 * Shared by the server and browser Sentry SDK init. Events go to the DSN given at runtime (Rustrak,
 * which speaks the Sentry protocol), without cookies, headers, bodies, query strings or user data.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export type SentrySettings = {
  dsn: string;
  environment?: string;
  /** Share of requests and page loads traced, between 0 and 1. Errors are always sent. */
  tracesSampleRate?: number;
};

// Path segments that are credentials by themselves.
const SECRET_PATH = /(\/veto\/)[^/?#\s"'[\]]+/g;

export function redactSecretPaths<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value === "string") return value.replace(SECRET_PATH, "$1[redacted]") as T;
  if (typeof value !== "object" || value === null || seen.has(value)) return value;
  seen.add(value);
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const item = record[key];
    const redacted = redactSecretPaths(item, seen);
    if (redacted !== item) record[key] = redacted;
  }
  return value;
}

export function parseSampleRate(raw: string | undefined): number | undefined {
  const rate = Number(raw);
  return rate > 0 && rate <= 1 ? rate : undefined;
}

export function sentryOptions({ dsn, environment, tracesSampleRate }: SentrySettings) {
  return {
    dsn,
    environment,
    // Left undefined, tracing stays off.
    tracesSampleRate,
    // Rustrak ingests whole transactions, not the streamed span format.
    traceLifecycle: "static" as const,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
      genAI: { inputs: false, outputs: false },
    },
    beforeSend: <E>(event: E) => redactSecretPaths(event),
    beforeSendTransaction: <E>(event: E) => redactSecretPaths(event),
    beforeBreadcrumb: <B>(breadcrumb: B) => redactSecretPaths(breadcrumb),
  };
}

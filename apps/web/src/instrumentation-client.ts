/**
 * GC-Stats - Browser instrumentation
 *
 * Runs before hydration. Starts error tracking when the server put a DSN on the <html> element
 * (read at runtime, so one image works in every environment).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
import * as Sentry from "@sentry/nextjs";
import { parseSampleRate, sentryOptions } from "@/lib/monitoring/sentry-options";

const { sentryDsn, sentryEnvironment, sentryTracesSampleRate } = document.documentElement.dataset;

if (sentryDsn) {
  Sentry.init(sentryOptions({ dsn: sentryDsn, environment: sentryEnvironment, tracesSampleRate: parseSampleRate(sentryTracesSampleRate) }));
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

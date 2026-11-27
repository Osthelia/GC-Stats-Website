/**
 * GC-Stats - Error boundary reporting
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
import { captureException } from "@sentry/nextjs";

export function captureBoundaryError(error: Error & { digest?: string }) {
  // An error with a digest comes from the server, which already reported it.
  if (!error.digest) captureException(error);
}

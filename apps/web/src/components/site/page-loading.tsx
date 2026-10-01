/**
 * GC-Stats - page-loading
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { Loader2 } from "lucide-react";

/** Full-page loading state for a public site route segment (`loading.tsx`), CLAUDE.md's "indicateur de chargement" rule. */
export function PageLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center py-20">
      <Loader2 className="size-6 animate-spin text-neutral-500" />
    </div>
  );
}

/**
 * GC-Stats - loading
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { Skeleton } from "@/components/ui/skeleton";

// The duplicates search compares every handle, so the page shows a skeleton while it runs.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-16 w-96 max-w-full" />
      <Skeleton className="h-80 w-full" />
    </div>
  );
}

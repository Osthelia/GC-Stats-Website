/**
 * GC-Stats - admin-refresh-button
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Re-renders the current server page (live stats), spinning while the new data loads. */
export function AdminRefreshButton({ label }: { label: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button variant="outline" size="sm" disabled={isPending} onClick={() => startTransition(() => router.refresh())}>
      <RefreshCw className={cn(isPending && "animate-spin")} />
      {label}
    </Button>
  );
}

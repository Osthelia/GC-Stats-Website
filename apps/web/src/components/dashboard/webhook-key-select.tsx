/**
 * GC-Stats - webhook-key-select
 *
 * Partner key picker of the dashboard webhooks pages.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function WebhookKeySelect({ keys, selectedId, basePath, label }: { keys: { id: number; clientName: string }[]; selectedId: number; basePath: string; label: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      {isPending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      <Select
        items={Object.fromEntries(keys.map((k) => [String(k.id), k.clientName]))}
        value={String(selectedId)}
        onValueChange={(v) => v && startTransition(() => router.push(`${basePath}?key=${v}`))}
      >
        <SelectTrigger aria-label={label} className="w-56" disabled={isPending}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {keys.map((k) => (
            <SelectItem key={k.id} value={String(k.id)}>
              {k.clientName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

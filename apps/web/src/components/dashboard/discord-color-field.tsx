/**
 * GC-Stats - discord-color-field
 *
 * Color picker with a reset to the default, shared by the server theme and the alert override.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/admin/form-field";

export function DiscordColorField({
  id,
  label,
  value,
  fallback,
  resetLabel,
  error,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  /** Null = not overridden, the fallback is shown. */
  value: string | null;
  fallback: string;
  resetLabel: string;
  error?: string;
  hint?: string;
  onChange: (value: string | null) => void;
}) {
  return (
    <FormField label={label} htmlFor={id} error={error} hint={hint}>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={value ?? fallback}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-14 cursor-pointer rounded-md border bg-transparent p-1 transition-opacity active:opacity-70"
        />
        <span className="font-mono text-xs text-muted-foreground">{value ?? fallback}</span>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <RotateCcw />
            {resetLabel}
          </Button>
        )}
      </div>
    </FormField>
  );
}

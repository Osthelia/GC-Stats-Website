/**
 * GC-Stats - switch-row
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { Switch } from "@/components/ui/switch";

/** Labelled switch of the admin settings forms. */
export function SwitchRow({ id, label, description, checked, onChange, disabled, error }: { id: string; label: string; description: string; checked: boolean; onChange: (v: boolean) => void; disabled: boolean; error?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <p className="text-xs text-muted-foreground">{description}</p>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

/**
 * GC-Stats - tags-input
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function TagsInput({
  value,
  onChange,
  placeholder,
  addLabel,
  emptyLabel,
  removeLabel,
  disabled,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
  addLabel: string;
  emptyLabel: string;
  removeLabel: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const tag = draft.trim();
    if (!tag || value.includes(tag)) {
      setDraft("");
      return;
    }
    onChange([...value, tag]);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          placeholder={placeholder}
          className="max-w-xs"
          disabled={disabled}
        />
        <Button type="button" variant="outline" size="sm" onClick={commit} disabled={disabled}>
          {addLabel}
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {value.length === 0 && <p className="text-xs text-muted-foreground">{emptyLabel}</p>}
        {value.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 pr-1">
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange(value.filter((t) => t !== tag))}
                aria-label={`${removeLabel} ${tag}`}
                className="rounded-full p-0.5 hover:bg-foreground/10"
              >
                <XIcon className="size-3" />
              </button>
            )}
          </Badge>
        ))}
      </div>
    </div>
  );
}

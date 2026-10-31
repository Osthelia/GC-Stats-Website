/**
 * GC-Stats - use-roster-source-mode
 *
 * Which choice of a roster source dropdown is active. An empty value is ambiguous
 * (no source, or a link not typed yet), so the link choice is kept locally.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useState } from "react";
import { rosterSourceTextKey, ROSTER_SOURCE_TEXTS, type RosterSourceTextKey } from "@/lib/roster-source";

export type RosterSourceMode = "none" | "link" | RosterSourceTextKey;

function modeOf(value: string): RosterSourceMode {
  if (!value.trim()) return "none";
  return rosterSourceTextKey(value) ?? "link";
}

export function useRosterSourceMode(value: string, onChange: (value: string) => void) {
  const [mode, setMode] = useState<RosterSourceMode>(() => modeOf(value));

  // The parent can change the value (form reset): follow it, keeping a link choice that is still empty.
  useEffect(() => {
    setMode((current) => (value.trim() ? modeOf(value) : current === "link" ? "link" : "none"));
  }, [value]);

  function select(next: RosterSourceMode) {
    setMode(next);
    if (next === "none" || next === "link") onChange("");
    else onChange(ROSTER_SOURCE_TEXTS[next]);
  }

  return { mode, select };
}

/**
 * GC-Stats - tournament-bracket-canvas-lazy
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// React Flow is loaded after hydration: the canvas needs the browser to measure and fit anyway.
export const TournamentBracketCanvasLazy = dynamic(
  () => import("@/components/tournament/tournament-bracket-canvas").then((m) => m.TournamentBracketCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[360px] items-center justify-center rounded-xl border border-neutral-800" style={{ background: "var(--gcs-surface-3)" }}>
        <Loader2 className="size-6 animate-spin text-neutral-500" />
      </div>
    ),
  },
);

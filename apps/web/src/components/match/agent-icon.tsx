/**
 * GC-Stats - agent-icon
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { agentIconUrl } from "@/lib/valorant-agents";

export function AgentIcon({ agent, size = "h-6 w-6", rounded = false }: { agent: string; size?: string; rounded?: boolean }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={`flex ${size} flex-none items-center justify-center border border-neutral-800 bg-[var(--gcs-surface-2)] text-[8px] font-black text-neutral-500 uppercase ${rounded ? "rounded-full" : "rounded-sm"}`}
        title={agent}
      >
        {agent.slice(0, 1)}
      </span>
    );
  }

  return (
    <img
      src={agentIconUrl(agent)}
      alt={agent}
      title={agent}
      loading="lazy"
      className={`${size} flex-none border border-neutral-800 bg-[var(--gcs-surface-2)] object-cover ${rounded ? "rounded-full" : "rounded-sm"}`}
      onError={() => setFailed(true)}
    />
  );
}

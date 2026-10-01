/**
 * GC-Stats - legacy-match-pool
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { stripAccents } from "@/lib/search-typo";
import { LegacyMatchPoolCard } from "@/components/admin/legacy-import/legacy-match-pool-card";
import type { EditorMatch } from "@/lib/admin-bracket-editor-data";

function entrantLabel(id: number | null, entrants: { id: number; displayName: string }[], tbdLabel: string): string {
  if (id === null) return tbdLabel;
  return entrants.find((e) => e.id === id)?.displayName ?? `#${id}`;
}

export function LegacyMatchPool({
  matches,
  entrants,
  selectedMatchId,
  isPending,
  onSelect,
}: {
  matches: EditorMatch[];
  entrants: { id: number; displayName: string }[];
  selectedMatchId: number | null;
  isPending: boolean;
  onSelect: (matchId: number) => void;
}) {
  const t = useTranslations("admin.tournaments.legacyImport");
  const tEditor = useTranslations("admin.tournaments.editor");
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => [...matches].sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? "")), [matches]);

  const normalizedQuery = stripAccents(query.trim().toLowerCase());
  const filtered = normalizedQuery
    ? sorted.filter((m) => {
        const a = stripAccents(entrantLabel(m.entrantAId, entrants, "").toLowerCase());
        const b = stripAccents(entrantLabel(m.entrantBId, entrants, "").toLowerCase());
        return a.includes(normalizedQuery) || b.includes(normalizedQuery);
      })
    : sorted;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold">{t("poolTitle")}</h2>
        <p className="text-xs text-muted-foreground">{t("poolCountLabel", { count: matches.length })}</p>
      </div>

      {selectedMatchId !== null && <p className="rounded-md border border-primary/40 bg-primary/5 px-2 py-1.5 text-xs text-primary">{t("selectedInstructions")}</p>}

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("poolSearchPlaceholder")} className="pl-8" />
      </div>

      <div className="flex max-h-[600px] flex-col gap-2 overflow-y-auto pr-1">
        {filtered.length === 0 && <p className="rounded-md border bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">{t("poolEmpty")}</p>}
        {filtered.map((m) => (
          <LegacyMatchPoolCard
            key={m.id}
            match={m}
            slotALabel={entrantLabel(m.entrantAId, entrants, tEditor("tbdLabel"))}
            slotBLabel={entrantLabel(m.entrantBId, entrants, tEditor("tbdLabel"))}
            selected={selectedMatchId === m.id}
            disabled={isPending}
            onClick={() => onSelect(m.id)}
          />
        ))}
      </div>
    </div>
  );
}

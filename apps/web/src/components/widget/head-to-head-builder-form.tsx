/**
 * GC-Stats - head-to-head-builder-form
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { PublicEntityPicker } from "@/components/forms/public-entity-picker";
import { WidgetCreditToggle } from "@/components/widget/widget-credit-toggle";
import type { HeadToHeadWidgetParams } from "@/lib/widget-params";

export function HeadToHeadBuilderForm({ initial }: { initial: HeadToHeadWidgetParams & { teamAName: string | null; teamBName: string | null; tournamentName: string | null } }) {
  const t = useTranslations("widget.builder");
  const router = useRouter();

  const [teamA, setTeamA] = useState<{ id: number; label: string } | null>(initial.teamA != null && initial.teamAName ? { id: initial.teamA, label: initial.teamAName } : null);
  const [teamB, setTeamB] = useState<{ id: number; label: string } | null>(initial.teamB != null && initial.teamBName ? { id: initial.teamB, label: initial.teamBName } : null);
  const [tournament, setTournament] = useState<{ id: number; label: string } | null>(
    initial.tournamentId != null && initial.tournamentName ? { id: initial.tournamentId, label: initial.tournamentName } : null,
  );
  const [startDate, setStartDate] = useState(initial.startDate ?? "");
  const [endDate, setEndDate] = useState(initial.endDate ?? "");
  const [patch, setPatch] = useState(initial.patch ?? "");
  const [mappool, setMappool] = useState(initial.mapPool.join(","));
  const [credit, setCredit] = useState(initial.credit);

  const sameTeam = teamA != null && teamB != null && teamA.id === teamB.id;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!teamA || !teamB || sameTeam) return;
    const params = new URLSearchParams();
    if (teamA) params.set("team_a", String(teamA.id));
    if (teamB) params.set("team_b", String(teamB.id));
    if (tournament) params.set("tournament_id", String(tournament.id));
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);
    if (patch) params.set("patch", patch);
    if (mappool) params.set("mappool", mappool);
    if (credit) params.set("credit", "1");
    router.push(`/widget?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-[10px] font-bold tracking-widest text-neutral-500 uppercase">
            {t("teamA")} <span className="text-red-500">*</span>
          </label>
          <PublicEntityPicker
            type="team"
            value={teamA}
            onChange={setTeamA}
            placeholder={t("teamA")}
            searchPlaceholder={t("searchTeam")}
            noResultsLabel={t("noResults")}
            excludeId={teamB?.id}
          />
        </div>
        <div>
          <label className="mb-2 block text-[10px] font-bold tracking-widest text-neutral-500 uppercase">
            {t("teamB")} <span className="text-red-500">*</span>
          </label>
          <PublicEntityPicker
            type="team"
            value={teamB}
            onChange={setTeamB}
            placeholder={t("teamB")}
            searchPlaceholder={t("searchTeam")}
            noResultsLabel={t("noResults")}
            excludeId={teamA?.id}
          />
        </div>
      </div>

      {sameTeam && <p className="text-[11.5px] font-medium text-red-400">{t("sameTeamError")}</p>}

      <div>
        <PublicEntityPicker type="tournament" value={tournament} onChange={setTournament} placeholder={t("tournament")} searchPlaceholder={t("searchTournament")} noResultsLabel={t("noResults")} />
        <p className="mt-1.5 text-[10px] text-neutral-500">{t("tournamentHint")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-[10px] font-bold tracking-widest text-neutral-500 uppercase">{t("startDate")}</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-3 py-2 text-[13.5px] text-neutral-50 outline-none [color-scheme:dark] focus:border-[#e4ae22]/60"
          />
        </div>
        <div>
          <label className="mb-2 block text-[10px] font-bold tracking-widest text-neutral-500 uppercase">{t("endDate")}</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-3 py-2 text-[13.5px] text-neutral-50 outline-none [color-scheme:dark] focus:border-[#e4ae22]/60"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-[10px] font-bold tracking-widest text-neutral-500 uppercase">{t("patch")}</label>
        <input
          type="text"
          value={patch}
          onChange={(e) => setPatch(e.target.value)}
          placeholder={t("patchPlaceholder")}
          className="w-full rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-3 py-2 text-[13.5px] text-neutral-50 outline-none focus:border-[#e4ae22]/60"
        />
        <p className="mt-1.5 text-[10px] text-neutral-500">{t("patchHint")}</p>
      </div>

      <div>
        <label className="mb-2 block text-[10px] font-bold tracking-widest text-neutral-500 uppercase">{t("mappool")}</label>
        <input
          type="text"
          value={mappool}
          onChange={(e) => setMappool(e.target.value)}
          placeholder={t("mappoolPlaceholder")}
          className="w-full rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-3 py-2 text-[13.5px] text-neutral-50 outline-none focus:border-[#e4ae22]/60"
        />
        <p className="mt-1.5 text-[10px] text-neutral-500">{t("mappoolHint")}</p>
      </div>

      <WidgetCreditToggle checked={credit} onChange={setCredit} />

      <button
        type="submit"
        disabled={!teamA || !teamB || sameTeam}
        className="w-full rounded-[9px] bg-[#e4ae22] py-3 text-[11px] font-black tracking-wider text-[#0e0e0e] uppercase transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {t("submit")}
      </button>
    </form>
  );
}

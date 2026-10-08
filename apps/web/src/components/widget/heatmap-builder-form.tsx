/**
 * GC-Stats - heatmap-builder-form
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
import { PublicOptionalSelect } from "@/components/forms/public-optional-select";
import { VALORANT_MAP_KEYS } from "@/lib/valorant-minimaps";
import { VALORANT_AGENTS } from "@/lib/valorant-agents";
import { WidgetCreditToggle } from "@/components/widget/widget-credit-toggle";
import type { HeatmapWidgetParams } from "@/lib/widget-params";

const EVENT_TYPES = ["kill", "plant", "defuse"] as const;

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function HeatmapBuilderForm({ initial }: { initial: HeatmapWidgetParams & { teamName: string | null; playerName: string | null; tournamentName: string | null } }) {
  const t = useTranslations("widget.builder");
  const router = useRouter();

  const [map, setMap] = useState<string | null>(initial.map);
  const [tournament, setTournament] = useState<{ id: number; label: string } | null>(
    initial.tournamentId != null && initial.tournamentName ? { id: initial.tournamentId, label: initial.tournamentName } : null,
  );
  const [startDate, setStartDate] = useState(initial.startDate ?? "");
  const [endDate, setEndDate] = useState(initial.endDate ?? "");
  const [side, setSide] = useState<string | null>(initial.side);
  const [team, setTeam] = useState<{ id: number; label: string } | null>(initial.teamId != null && initial.teamName ? { id: initial.teamId, label: initial.teamName } : null);
  const [player, setPlayer] = useState<{ id: number; label: string } | null>(initial.playerId != null && initial.playerName ? { id: initial.playerId, label: initial.playerName } : null);
  const [timeReference, setTimeReference] = useState<string>(initial.timeReference);
  const [timeStart, setTimeStart] = useState(initial.timeStart != null ? String(initial.timeStart) : "");
  const [timeEnd, setTimeEnd] = useState(initial.timeEnd != null ? String(initial.timeEnd) : "");
  const [agent, setAgent] = useState<string | null>(initial.agent);
  const [color, setColor] = useState(initial.color ?? "2a78d6");
  const [rotation, setRotation] = useState<string>(initial.rotation);
  const [credit, setCredit] = useState(initial.credit);
  const [eventTypes, setEventTypes] = useState<string[]>(initial.eventTypes.length > 0 ? initial.eventTypes : ["kill", "plant", "defuse"]);

  function toggleEventType(type: string) {
    setEventTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

  const noEventTypes = eventTypes.length === 0;
  const invalidTimeRange = timeStart !== "" && timeEnd !== "" && Number(timeEnd) < Number(timeStart);
  const canSubmit = !!map && !noEventTypes && !invalidTimeRange;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const params = new URLSearchParams();
    params.set("map", map);
    if (tournament) params.set("tournament_id", String(tournament.id));
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);
    if (side) params.set("side", side);
    if (team) params.set("team_id", String(team.id));
    if (player) params.set("player_id", String(player.id));
    if (timeReference !== "round") params.set("time_reference", timeReference);
    if (timeStart) params.set("time_start", timeStart);
    if (timeEnd) params.set("time_end", timeEnd);
    if (agent) params.set("agent", agent);
    if (color) params.set("color", color);
    if (eventTypes.length > 0) params.set("event_type", eventTypes.join(","));
    if (rotation === "def") params.set("rotation", "def");
    if (credit) params.set("credit", "1");
    router.push(`/widget?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block text-[10px] font-bold tracking-widest text-neutral-500 uppercase">
          {t("map")} <span className="text-red-500">*</span>
        </label>
        <PublicOptionalSelect value={map} onChange={setMap} placeholder={t("mapPlaceholder")} options={VALORANT_MAP_KEYS.map((m) => ({ value: m, label: capitalize(m) }))} />
      </div>

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
        <label className="mb-2 block text-[10px] font-bold tracking-widest text-neutral-500 uppercase">{t("side")}</label>
        <PublicOptionalSelect
          value={side}
          onChange={setSide}
          placeholder={t("sideAll")}
          options={[
            { value: "atk", label: t("sideAtk") },
            { value: "def", label: t("sideDef") },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PublicEntityPicker type="team" value={team} onChange={setTeam} placeholder={t("team")} searchPlaceholder={t("searchTeam")} noResultsLabel={t("noResults")} />
        <PublicEntityPicker type="player" value={player} onChange={setPlayer} placeholder={t("player")} searchPlaceholder={t("searchPlayer")} noResultsLabel={t("noResults")} />
      </div>

      <div>
        <label className="mb-2 block text-[10px] font-bold tracking-widest text-neutral-500 uppercase">{t("timeReference")}</label>
        <PublicOptionalSelect
          value={timeReference}
          onChange={(v) => setTimeReference(v ?? "round")}
          placeholder={t("timeReferenceRound")}
          options={[
            { value: "round", label: t("timeReferenceRound") },
            { value: "plant", label: t("timeReferencePlant") },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-[10px] font-bold tracking-widest text-neutral-500 uppercase">{t("timeStart")}</label>
          <input
            type="number"
            min={0}
            step={1}
            value={timeStart}
            onChange={(e) => setTimeStart(e.target.value)}
            placeholder="0"
            className="w-full rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-3 py-2 text-[13.5px] text-neutral-50 outline-none focus:border-[#e4ae22]/60"
          />
        </div>
        <div>
          <label className="mb-2 block text-[10px] font-bold tracking-widest text-neutral-500 uppercase">{t("timeEnd")}</label>
          <input
            type="number"
            min={0}
            step={1}
            value={timeEnd}
            onChange={(e) => setTimeEnd(e.target.value)}
            placeholder="100"
            className="w-full rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-3 py-2 text-[13.5px] text-neutral-50 outline-none focus:border-[#e4ae22]/60"
          />
        </div>
      </div>
      <p className="-mt-2 text-[10px] text-neutral-500">{t("timeHint")}</p>
      {invalidTimeRange && <p className="-mt-2 text-[11.5px] font-medium text-red-400">{t("timeRangeError")}</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-[10px] font-bold tracking-widest text-neutral-500 uppercase">{t("agent")}</label>
          <PublicOptionalSelect value={agent} onChange={setAgent} placeholder={t("agentAll")} options={VALORANT_AGENTS.map((a) => ({ value: a, label: a }))} />
        </div>
        <div>
          <label className="mb-2 block text-[10px] font-bold tracking-widest text-neutral-500 uppercase">{t("color")}</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={`#${color}`}
              onChange={(e) => setColor(e.target.value.replace("#", ""))}
              className="h-[38px] w-14 shrink-0 cursor-pointer rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)]"
            />
            <p className="text-[10px] text-neutral-500">{t("colorHint")}</p>
          </div>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-[10px] font-bold tracking-widest text-neutral-500 uppercase">{t("eventTypes")}</label>
        <div className="flex flex-wrap gap-2">
          {EVENT_TYPES.map((type) => {
            const active = eventTypes.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleEventType(type)}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                  active ? "border-[#e4ae22] bg-[#e4ae22] text-[#0e0e0e]" : "border-neutral-700 bg-[var(--gcs-surface-2)] text-neutral-400 hover:bg-white/5"
                }`}
              >
                {t(`event${capitalize(type)}`)}
              </button>
            );
          })}
        </div>
        {noEventTypes && <p className="mt-2 text-[11.5px] font-medium text-red-400">{t("eventTypesError")}</p>}
      </div>

      <div>
        <label className="mb-2 block text-[10px] font-bold tracking-widest text-neutral-500 uppercase">{t("rotation")}</label>
        <PublicOptionalSelect
          value={rotation}
          onChange={(v) => setRotation(v ?? "atk")}
          placeholder={t("rotationAtk")}
          options={[
            { value: "atk", label: t("rotationAtk") },
            { value: "def", label: t("rotationDef") },
          ]}
        />
        <p className="mt-1.5 text-[10px] text-neutral-500">{t("rotationHint")}</p>
      </div>

      <WidgetCreditToggle checked={credit} onChange={setCredit} />

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-[9px] bg-[#e4ae22] py-3 text-[11px] font-black tracking-wider text-[#0e0e0e] uppercase transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {t("submit")}
      </button>
    </form>
  );
}

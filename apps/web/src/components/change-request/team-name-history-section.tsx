/**
 * GC-Stats - team-name-history-section
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { TeamNameHistoryEntry } from "@/lib/team-page-data";
import type { NameHistoryOperation } from "@/lib/change-request-fields";

const inputClass =
  "rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-2.5 py-1.5 text-[12.5px] text-neutral-50 outline-none transition-colors focus:border-[#e4ae22]/60";

type EditState = { isVisible: boolean; deleted: boolean };

/** Same name-history editing as admin (components/admin/team-name-history-panel.tsx), staged as a proposal instead of writing directly. */
export function TeamNameHistorySection({ entries, onChange }: { entries: TeamNameHistoryEntry[]; onChange: (ops: NameHistoryOperation[]) => void }) {
  const t = useTranslations("suggestEdit.nameHistory");

  const [edits, setEdits] = useState<Record<number, EditState>>(() =>
    Object.fromEntries(entries.map((e) => [e.id, { isVisible: e.isVisible, deleted: false }]))
  );
  const [name, setName] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [additions, setAdditions] = useState<{ name: string; since: string; until: string }[]>([]);

  function emit(nextEdits: Record<number, EditState>, nextAdditions: { name: string; since: string; until: string }[]) {
    const ops: NameHistoryOperation[] = [];
    for (const entry of entries) {
      const edit = nextEdits[entry.id];
      if (!edit) continue;
      if (edit.deleted) {
        ops.push({ type: "delete", id: entry.id });
        continue;
      }
      if (edit.isVisible !== entry.isVisible) ops.push({ type: "toggle", id: entry.id, isVisible: edit.isVisible });
    }
    for (const draft of nextAdditions) {
      if (!draft.name.trim() || !draft.since) continue;
      ops.push({ type: "add", name: draft.name.trim(), since: draft.since, until: draft.until || null });
    }
    onChange(ops);
  }

  function toggle(id: number) {
    const next = { ...edits, [id]: { ...edits[id]!, isVisible: !edits[id]!.isVisible } };
    setEdits(next);
    emit(next, additions);
  }

  function remove(id: number) {
    const next = { ...edits, [id]: { ...edits[id]!, deleted: !edits[id]!.deleted } };
    setEdits(next);
    emit(next, additions);
  }

  function addEntry() {
    if (!name.trim() || !since) return;
    const next = [...additions, { name: name.trim(), since, until }];
    setAdditions(next);
    setName("");
    setSince("");
    setUntil("");
    emit(edits, next);
  }

  function removeAddition(index: number) {
    const next = additions.filter((_, i) => i !== index);
    setAdditions(next);
    emit(edits, next);
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-neutral-800 bg-[var(--gcs-surface)] p-6">
      <h2 className="text-[15px] font-semibold text-neutral-50">{t("title")}</h2>

      {entries.length === 0 && <p className="text-[13.5px] text-neutral-500">{t("empty")}</p>}

      <div className="flex flex-col gap-2">
        {entries.map((entry) => {
          const edit = edits[entry.id]!;
          return (
            <div key={entry.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-800 px-3 py-2 ${edit.deleted ? "opacity-40" : ""}`}>
              <div className="flex flex-wrap items-center gap-2 text-[13.5px]">
                <span className="font-semibold text-neutral-100">{entry.name}</span>
                <span className="text-[12px] text-neutral-500">
                  {entry.since ?? "?"} → {entry.until ?? t("ongoing")}
                </span>
                {!edit.isVisible && <span className="rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] text-neutral-500">{t("hidden")}</span>}
              </div>
              {!edit.deleted && (
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => toggle(entry.id)} className="text-[12px] text-neutral-400 underline hover:text-neutral-200">
                    {edit.isVisible ? t("hide") : t("show")}
                  </button>
                  <button type="button" onClick={() => remove(entry.id)} className="text-[12px] text-[#e08585] underline hover:text-[#f0a0a0]">
                    {t("remove")}
                  </button>
                </div>
              )}
              {edit.deleted && (
                <button type="button" onClick={() => remove(entry.id)} className="text-[12px] text-neutral-400 underline hover:text-neutral-200">
                  {t("undoRemove")}
                </button>
              )}
            </div>
          );
        })}

        {additions.map((draft, i) => (
          <div key={`new-${i}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-neutral-700 px-3 py-2">
            <span className="text-[13.5px] text-neutral-300">
              {draft.name} · {draft.since} → {draft.until || t("ongoing")}
            </span>
            <button type="button" onClick={() => removeAddition(i)} className="text-[12px] text-[#e08585] underline hover:text-[#f0a0a0]">
              {t("remove")}
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2 border-t border-neutral-800 pt-4">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-neutral-400">{t("fieldName")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-neutral-400">{t("fieldSince")}</span>
          <input type="date" value={since} onChange={(e) => setSince(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-neutral-400">{t("fieldUntil")}</span>
          <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className={inputClass} />
        </label>
        <button
          type="button"
          onClick={addEntry}
          className="rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-3.5 py-1.5 text-[12.5px] font-semibold text-neutral-300 transition-colors hover:border-[#e4ae22]/60"
        >
          {t("addRow")}
        </button>
      </div>
    </div>
  );
}

/**
 * GC-Stats - logo-change-section
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { AdminLogoEntry } from "@/lib/admin-logos";
import { PublicSelect } from "@/components/forms/public-select";
import type { LogoOperation } from "@/lib/change-request-fields";

const inputClass =
  "rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-2.5 py-1.5 text-[12.5px] text-neutral-50 outline-none transition-colors focus:border-[#e4ae22]/60";

const NO_THEME = "";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

type EditState = { theme: string; since: string; until: string; deleted: boolean };

/**
 * Same logo-history editing surface as admin (components/admin/entity-logo-panel.tsx):
 * current + full history, each entry's theme/dates editable, deletable, plus
 * uploading a brand new one — staged as a proposal instead of writing
 * directly (a public visitor can't hold teams.edit/players.edit). The new
 * image is uploaded to the bucket immediately (see actions/change-requests.ts)
 * but only linked to a `logos` row once staff approves.
 */
export function LogoChangeSection({
  logos,
  onFileChange,
  onOperationsChange,
}: {
  logos: AdminLogoEntry[];
  onFileChange: (file: File | null, meta: { theme: string; since: string; until: string }) => void;
  onOperationsChange: (ops: LogoOperation[]) => void;
}) {
  const t = useTranslations("suggestEdit.logo");
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [newTheme, setNewTheme] = useState(NO_THEME);
  const [newSince, setNewSince] = useState(today);
  const [newUntil, setNewUntil] = useState("");

  const [edits, setEdits] = useState<Record<string, EditState>>(() =>
    Object.fromEntries(logos.map((l) => [l.id, { theme: l.theme ?? NO_THEME, since: l.since ?? today(), until: l.until ?? "", deleted: false }]))
  );

  const current = logos.find((l) => l.isOngoing && l.isVisible) ?? null;
  const themeOptions = [
    { value: NO_THEME, label: t("themeNone") },
    { value: "light", label: t("themeLight") },
    { value: "dark", label: t("themeDark") },
  ];

  function handleFile(file: File | null) {
    setFileName(file?.name ?? null);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
    onFileChange(file, { theme: newTheme, since: newSince, until: newUntil });
  }

  function emitOps(next: Record<string, EditState>) {
    const ops: LogoOperation[] = [];
    for (const entry of logos) {
      const edit = next[entry.id];
      if (!edit) continue;
      if (edit.deleted) {
        ops.push({ type: "delete", logoId: entry.id });
        continue;
      }
      const changed = (edit.theme || null) !== entry.theme || edit.since !== (entry.since ?? today()) || (edit.until || null) !== entry.until;
      if (changed) ops.push({ type: "edit", logoId: entry.id, theme: edit.theme || null, since: edit.since, until: edit.until || null });
    }
    onOperationsChange(ops);
  }

  function updateEdit(id: string, patch: Partial<EditState>) {
    const next = { ...edits, [id]: { ...edits[id]!, ...patch } };
    setEdits(next);
    emitOps(next);
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-neutral-800 bg-[var(--gcs-surface)] p-6">
      <h2 className="text-[15px] font-semibold text-neutral-50">{t("title")}</h2>

      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 flex-none items-center justify-center rounded-xl border border-neutral-800 bg-[var(--gcs-surface-2)]">
          {current ? (
            <Image src={current.thumbnailUrl ?? current.url ?? ""} alt="" width={52} height={52} className="h-13 w-13 rounded-lg object-contain" unoptimized />
          ) : (
            <span className="text-[11px] text-neutral-600">{t("none")}</span>
          )}
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{t("current")}</span>
      </div>

      {logos.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{t("history")}</span>
          {logos.map((entry) => {
            const edit = edits[entry.id]!;
            return (
              <div
                key={entry.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-800 px-3 py-2 ${edit.deleted ? "opacity-40" : ""}`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-neutral-800 bg-[var(--gcs-surface-2)]">
                    {entry.thumbnailUrl && <Image src={entry.thumbnailUrl} alt="" width={32} height={32} className="h-8 w-8 rounded-md object-contain" unoptimized />}
                  </div>
                  {!edit.deleted ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <PublicSelect value={edit.theme} onChange={(v) => updateEdit(entry.id, { theme: v })} options={themeOptions} />
                      <input type="date" value={edit.since} onChange={(e) => updateEdit(entry.id, { since: e.target.value })} className={inputClass} />
                      <input type="date" value={edit.until} onChange={(e) => updateEdit(entry.id, { until: e.target.value })} className={inputClass} />
                    </div>
                  ) : (
                    <span className="text-[12px] text-neutral-500">
                      {entry.since ?? "?"} → {entry.until ?? t("ongoing")}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => updateEdit(entry.id, { deleted: !edit.deleted })}
                  className="text-[12px] text-[#e08585] underline hover:text-[#f0a0a0]"
                >
                  {edit.deleted ? t("undoRemove") : t("remove")}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-neutral-800 pt-4">
        <span className="text-[13px] font-medium text-neutral-300">{t("addNew")}</span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-4 py-2 text-[13.5px] font-semibold text-neutral-200 transition-colors hover:border-[#e4ae22]/60"
          >
            {t("choose")}
          </button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
          <PublicSelect
            value={newTheme}
            onChange={(v) => {
              setNewTheme(v);
              if (fileName) onFileChange(inputRef.current?.files?.[0] ?? null, { theme: v, since: newSince, until: newUntil });
            }}
            options={themeOptions}
          />
          <input
            type="date"
            value={newSince}
            onChange={(e) => {
              setNewSince(e.target.value);
              if (fileName) onFileChange(inputRef.current?.files?.[0] ?? null, { theme: newTheme, since: e.target.value, until: newUntil });
            }}
            className={inputClass}
          />
          <input
            type="date"
            value={newUntil}
            onChange={(e) => {
              setNewUntil(e.target.value);
              if (fileName) onFileChange(inputRef.current?.files?.[0] ?? null, { theme: newTheme, since: newSince, until: e.target.value });
            }}
            className={inputClass}
          />
          {fileName && (
            <div className="flex items-center gap-2">
              {preview && <Image src={preview} alt="" width={28} height={28} className="h-7 w-7 rounded-md object-contain" unoptimized />}
              <span className="truncate text-[13px] text-neutral-400">{fileName}</span>
              <button
                type="button"
                onClick={() => {
                  inputRef.current!.value = "";
                  handleFile(null);
                }}
                className="text-[12px] text-neutral-500 underline hover:text-neutral-300"
              >
                {t("remove")}
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="text-[12px] leading-relaxed text-neutral-500">{t("hint")}</p>
    </div>
  );
}

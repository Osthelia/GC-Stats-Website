/**
 * GC-Stats - liquipedia-transfers-form
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { LiquipediaWikicodeBlock } from "@/components/match/liquipedia-wikicode-block";
import { completeTransfersWikicode, type TransfersFieldErrors, type TransfersResult } from "@/actions/liquipedia-transfers";
import { TRANSFERS_WIKICODE_MAX_LENGTH } from "@/lib/liquipedia-transfers-wikicode";

const inputClass =
  "w-full rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-3.5 py-2.5 text-[14.5px] text-neutral-50 outline-none transition-colors focus:border-[#e4ae22]/60 aria-[invalid=true]:border-[#e08585]";

type Completed = Extract<TransfersResult, { ok: true }>;

function WarningList({ label, names }: { label: string; names: string[] }) {
  if (names.length === 0) return null;
  return (
    <p className="text-[13px] leading-relaxed text-neutral-400">
      <span className="font-semibold text-neutral-300">{label}</span> {names.join(", ")}
    </p>
  );
}

export function LiquipediaTransfersForm() {
  const t = useTranslations("liquipediaTransfers");
  const [wikicode, setWikicode] = useState("");
  const [month, setMonth] = useState("");
  const [fieldErrors, setFieldErrors] = useState<TransfersFieldErrors>({});
  const [result, setResult] = useState<Completed | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    startTransition(async () => {
      try {
        const response = await completeTransfersWikicode(wikicode, month);
        if (!response.ok) {
          setResult(null);
          setFieldErrors(response.fieldErrors);
          return;
        }
        setResult(response);
      } catch (error) {
        console.error("[liquipedia-transfers] completion failed", error);
        toast.error(t("error.generic"));
      }
    });
  }

  const errorText = (field: keyof TransfersFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}` as "error.required") : undefined);
  const wikicodeError = errorText("wikicode");
  const monthError = errorText("month");

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-2xl border border-neutral-800 bg-[var(--gcs-surface)] p-6">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-neutral-400">
            {t("wikicodeLabel")} <span className="text-[#e08585]">*</span>
          </span>
          <textarea
            value={wikicode}
            onChange={(e) => setWikicode(e.target.value)}
            aria-invalid={!!wikicodeError}
            rows={14}
            maxLength={TRANSFERS_WIKICODE_MAX_LENGTH}
            spellCheck={false}
            placeholder={t("wikicodePlaceholder")}
            className={`${inputClass} font-mono text-[12.5px] leading-relaxed`}
          />
          {wikicodeError && <span className="text-[12px] text-[#e08585]">{wikicodeError}</span>}
        </label>

        <label className="flex max-w-xs flex-col gap-1.5">
          <span className="text-[13px] text-neutral-400">{t("monthLabel")}</span>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-invalid={!!monthError} className={inputClass} />
          <span className="text-[12px] text-neutral-500">{t("monthHint")}</span>
          {monthError && <span className="text-[12px] text-[#e08585]">{monthError}</span>}
        </label>

        <div>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-[9px] bg-[#e4ae22] px-5 py-2.5 text-[14px] font-semibold text-[#0e0e0e] transition-all hover:bg-[#c9981d] active:scale-[0.97] active:bg-[#b3860f] disabled:opacity-60"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            {pending ? t("submitting") : t("submit")}
          </button>
        </div>
      </form>

      {result && (
        <div className="flex flex-col gap-4">
          <p className="text-[14px] font-semibold text-neutral-100">
            {result.addedRows > 0 ? t("summary", { count: result.addedRows, month: result.month }) : t("nothingToAdd", { month: result.month })}
          </p>
          <WarningList label={t("alreadyListed", { count: result.alreadyListed.length })} names={result.alreadyListed} />
          <WarningList label={t("unlinkedTeams", { count: result.unlinkedTeams.length })} names={result.unlinkedTeams} />
          <WarningList label={t("unlinkedPeople", { count: result.unlinkedPeople.length })} names={result.unlinkedPeople} />
          <WarningList label={t("missingSources", { count: result.missingSources.length })} names={result.missingSources} />
          <LiquipediaWikicodeBlock wikicode={result.wikicode} />
        </div>
      )}
    </div>
  );
}

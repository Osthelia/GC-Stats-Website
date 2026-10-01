/**
 * GC-Stats - widget-directory
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { WidgetBuilderModal } from "@/components/widget/widget-builder-modal";
import { HeadToHeadBuilderForm } from "@/components/widget/head-to-head-builder-form";
import { HeatmapBuilderForm } from "@/components/widget/heatmap-builder-form";
import type { HeadToHeadWidgetParams, HeatmapWidgetParams } from "@/lib/widget-params";

type HeadToHeadInitial = HeadToHeadWidgetParams & { teamAName: string | null; teamBName: string | null; tournamentName: string | null };
type HeatmapInitial = HeatmapWidgetParams & { teamName: string | null; playerName: string | null; tournamentName: string | null };

function ResultPanel({ url }: { url: string }) {
  const t = useTranslations("widget.result");
  const [copied, setCopied] = useState(false);
  const fullUrl = typeof window !== "undefined" ? `${window.location.origin}${url}` : url;

  return (
    <div className="mt-2 space-y-3 border-t border-neutral-800 pt-4">
      <h3 className="text-[10px] font-black tracking-widest text-neutral-500 uppercase">{t("title")}</h3>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          readOnly
          value={fullUrl}
          onClick={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface)] px-3 py-2 font-mono text-xs text-neutral-300 outline-none"
        />
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(fullUrl);
                setCopied(true);
                toast.success(t("copied"));
                setTimeout(() => setCopied(false), 1200);
              } catch {
                toast.error(t("copyError"));
              }
            }}
            className="rounded-[9px] bg-[#e4ae22] px-4 py-2 text-[10px] font-black tracking-wider text-[#0e0e0e] uppercase transition-opacity hover:opacity-90"
          >
            {copied ? t("copied") : t("copy")}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener"
            className="rounded-[9px] border border-neutral-700 px-4 py-2 text-[10px] font-black tracking-wider text-neutral-300 uppercase transition-colors hover:border-[#e4ae22]/60 hover:text-neutral-50"
          >
            {t("open")}
          </a>
        </div>
      </div>

      <p className="text-[10px] text-neutral-500">{t("embedHint")}</p>

      <p className="mt-4 mb-2 text-[10px] font-bold tracking-widest text-neutral-500 uppercase">{t("preview")}</p>
      <div className="overflow-hidden rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface)]" style={{ height: 380 }}>
        <iframe src={url} title={t("preview")} className="h-full w-full" style={{ border: 0 }} loading="lazy" />
      </div>
    </div>
  );
}

function WidgetCard({ name, description, previewUrl, noPreviewLabel, configureLabel, onConfigure }: { name: string; description: string; previewUrl: string | null; noPreviewLabel: string; configureLabel: string; onConfigure: () => void }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-neutral-800" style={{ background: "var(--gcs-surface)" }}>
      <div className="relative aspect-square overflow-hidden border-b border-neutral-800 bg-black">
        {previewUrl ? (
          <iframe src={previewUrl} className="pointer-events-none absolute inset-0 h-full w-full" style={{ border: 0 }} loading="lazy" tabIndex={-1} aria-hidden />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-[10px] font-bold tracking-widest text-neutral-600 uppercase">{noPreviewLabel}</div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-sm font-bold tracking-wide text-neutral-50 uppercase">{name}</p>
        <p className="mt-2 flex-1 text-xs leading-relaxed text-neutral-500">{description}</p>
        <button
          type="button"
          onClick={onConfigure}
          className="mt-4 w-full rounded-[9px] bg-[#e4ae22] py-2.5 text-[10px] font-black tracking-wider text-[#0e0e0e] uppercase transition-opacity hover:opacity-90"
        >
          {configureLabel}
        </button>
      </div>
    </div>
  );
}

export function WidgetDirectory({
  headToHead,
  heatmap,
}: {
  headToHead: { previewUrl: string | null; generatedUrl: string | null; autoOpen: boolean; initial: HeadToHeadInitial };
  heatmap: { previewUrl: string; generatedUrl: string | null; autoOpen: boolean; initial: HeatmapInitial };
}) {
  const t = useTranslations("widget");
  const [openModal, setOpenModal] = useState<"headToHead" | "heatmap" | null>(headToHead.autoOpen ? "headToHead" : heatmap.autoOpen ? "heatmap" : null);

  return (
    <>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <WidgetCard
          name={t("available.headToHead.name")}
          description={t("available.headToHead.description")}
          previewUrl={headToHead.previewUrl}
          noPreviewLabel={t("noPreview")}
          configureLabel={t("configure")}
          onConfigure={() => setOpenModal("headToHead")}
        />
        <WidgetCard
          name={t("available.heatmap.name")}
          description={t("available.heatmap.description")}
          previewUrl={heatmap.previewUrl}
          noPreviewLabel={t("noPreview")}
          configureLabel={t("configure")}
          onConfigure={() => setOpenModal("heatmap")}
        />
      </div>

      {openModal === "headToHead" && (
        <WidgetBuilderModal title={t("available.headToHead.name")} onClose={() => setOpenModal(null)}>
          <HeadToHeadBuilderForm initial={headToHead.initial} />
          {headToHead.generatedUrl && <ResultPanel url={headToHead.generatedUrl} />}
        </WidgetBuilderModal>
      )}

      {openModal === "heatmap" && (
        <WidgetBuilderModal title={t("available.heatmap.name")} onClose={() => setOpenModal(null)}>
          <HeatmapBuilderForm initial={heatmap.initial} />
          {heatmap.generatedUrl && <ResultPanel url={heatmap.generatedUrl} />}
        </WidgetBuilderModal>
      )}
    </>
  );
}

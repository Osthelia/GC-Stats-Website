/**
 * GC-Stats - match-poster-dialog
 *
 * Share dialog producing a PNG of a match, for all maps or a single one.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toBlob } from "html-to-image";
import { CheckIcon, CopyIcon, DownloadIcon, Loader2Icon, RotateCcwIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MatchPoster, POSTER_WIDTH, type PosterData } from "@/components/match/match-poster";
import { slugify } from "@/lib/entity-id";

const PILL_BASE = "rounded-full px-5 py-2 text-[11px] font-black tracking-widest uppercase transition-all duration-200 active:scale-95";
const PILL_ACTIVE = "bg-[#e4ae22] text-black shadow-[0_0_18px_rgba(228,174,34,0.35)]";
const PILL_IDLE = "bg-white/5 text-neutral-400 hover:-translate-y-0.5 hover:bg-white/10 hover:text-neutral-200 active:translate-y-0";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; data: PosterData };

export function MatchPosterDialog({ matchId, open, onOpenChange }: { matchId: number; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("matchPoster");
  const tMatch = useTranslations("matchPage");
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [mapId, setMapId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState<"download" | "copy" | null>(null);
  const [copied, setCopied] = useState(false);
  const [scale, setScale] = useState(0);
  const [posterHeight, setPosterHeight] = useState(0);
  const [watermark, setWatermark] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const posterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setState({ status: "loading" });
    fetch(`/api/match-poster/${matchId}`, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<PosterData>) : Promise.reject(new Error(String(res.status)))))
      .then((data) => setState({ status: "ready", data }))
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.warn("[match-poster] Load failed", error);
          setState({ status: "error" });
        }
      });
    return () => controller.abort();
  }, [open, matchId, attempt]);

  // The poster is a fixed width canvas (POSTER_WIDTH), scaled down to fit the dialog for the preview only.
  const frameCallback = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new ResizeObserver(() => setScale(node.clientWidth / POSTER_WIDTH));
    observer.observe(node);
    setScale(node.clientWidth / POSTER_WIDTH);
    return () => observer.disconnect();
  }, []);

  // The poster height follows its content (map or not, player count), so the frame tracks it.
  const ready = state.status === "ready" && scale > 0;
  useEffect(() => {
    const node = posterRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setPosterHeight(node.offsetHeight));
    observer.observe(node);
    setPosterHeight(node.offsetHeight);
    return () => observer.disconnect();
  }, [ready]);

  const render = () => toBlob(posterRef.current!, { width: POSTER_WIDTH, height: posterHeight, pixelRatio: 1, cacheBust: false, includeQueryParams: true });

  const download = async () => {
    if (!posterRef.current || state.status !== "ready") return;
    setExporting(true);
    setExportFailed(null);
    try {
      const blob = await render();
      if (!blob) throw new Error("Empty capture");
      const { match, maps } = state.data;
      const mapName = mapId != null ? maps.find((m) => m.id === mapId)?.mapName : null;
      const link = document.createElement("a");
      link.download = `${["gcs", slugify(match.a.displayName), "vs", slugify(match.b.displayName), mapName ? slugify(mapName) : null].filter(Boolean).join("-")}.png`;
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.warn("[match-poster] Export failed", error);
      setExportFailed("download");
    } finally {
      setExporting(false);
    }
  };

  const copy = async () => {
    if (!posterRef.current || state.status !== "ready") return;
    setExporting(true);
    setExportFailed(null);
    try {
      const blob = await render();
      if (!blob) throw new Error("Empty capture");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
    } catch (error) {
      console.warn("[match-poster] Copy failed", error);
      setExportFailed("copy");
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const playedMaps = state.status === "ready" ? state.data.maps.filter((m) => m.isCompleted && m.teamAScore != null && m.teamBScore != null && !(m.teamAScore === -1 && m.teamBScore === -1)) : [];
  const url = typeof window === "undefined" ? "" : `${window.location.host}/match/${matchId}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description", { width: POSTER_WIDTH })}</DialogDescription>
        </DialogHeader>

        {state.status === "ready" && playedMaps.length > 0 && (
          <div className="flex flex-wrap gap-2" role="tablist" aria-label={tMatch("maps")}>
            <button type="button" role="tab" aria-selected={mapId == null} onClick={() => setMapId(null)} className={`${PILL_BASE} ${mapId == null ? PILL_ACTIVE : PILL_IDLE}`}>
              {tMatch("allMaps")}
            </button>
            {playedMaps.map((m) => (
              <button key={m.id} type="button" role="tab" aria-selected={mapId === m.id} onClick={() => setMapId(m.id)} className={`${PILL_BASE} ${mapId === m.id ? PILL_ACTIVE : PILL_IDLE}`}>
                {m.mapName}
              </button>
            ))}
          </div>
        )}

        <div ref={frameCallback} className="relative w-full overflow-hidden rounded-xl border border-neutral-800" style={{ background: "var(--gcs-surface-2)", height: ready && posterHeight > 0 ? posterHeight * scale : undefined, minHeight: ready ? undefined : 240 }}>
          {state.status === "ready" && scale > 0 && (
            <div style={{ width: POSTER_WIDTH, transform: `scale(${scale})`, transformOrigin: "top left" }}>
              <div ref={posterRef} style={{ width: POSTER_WIDTH }}>
                <MatchPoster data={state.data} mapId={mapId} url={url} watermark={watermark} />
              </div>
            </div>
          )}
          {state.status === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-neutral-400">
              <Loader2Icon className="h-4 w-4 animate-spin" />
              {t("loading")}
            </div>
          )}
          {state.status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-neutral-400">
              {t("loadError")}
              <button
                type="button"
                onClick={() => setAttempt((n) => n + 1)}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-white/5 px-3 py-1.5 text-xs font-semibold text-neutral-300 transition-all duration-200 hover:border-neutral-500 hover:text-neutral-50 active:scale-[0.97]"
              >
                <RotateCcwIcon className="h-3.5 w-3.5" />
                {t("retry")}
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-300 select-none">
            <Checkbox checked={watermark} onCheckedChange={(checked) => setWatermark(checked === true)} />
            {t("watermark")}
          </label>
          <div className="flex items-center gap-3">
          {exportFailed && <span className="text-xs text-red-400">{t(exportFailed === "copy" ? "copyError" : "exportError")}</span>}
          <button
            type="button"
            onClick={copy}
            disabled={state.status !== "ready" || exporting}
            className="flex items-center gap-2 rounded-lg border border-neutral-700 bg-white/5 px-4 py-2 text-xs font-black tracking-widest text-neutral-200 uppercase transition-all duration-200 hover:-translate-y-0.5 hover:border-neutral-500 hover:text-white active:translate-y-0 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50"
          >
            {copied ? <CheckIcon className="h-3.5 w-3.5 text-emerald-400" /> : <CopyIcon className="h-3.5 w-3.5" />}
            {copied ? t("copied") : t("copy")}
          </button>
          <button
            type="button"
            onClick={download}
            disabled={state.status !== "ready" || exporting}
            className="flex items-center gap-2 rounded-lg bg-[#e4ae22] px-4 py-2 text-xs font-black tracking-widest text-black uppercase transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50"
          >
            {exporting ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : <DownloadIcon className="h-3.5 w-3.5" />}
            {exporting ? t("exporting") : t("download")}
          </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

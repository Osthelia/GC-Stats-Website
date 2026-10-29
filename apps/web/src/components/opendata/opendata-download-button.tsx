/**
 * GC-Stats - opendata-download-button
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { openDataExportFileName, type OpenDataDataset, type OpenDataErrorCode } from "@/lib/opendata/datasets-meta";
import { cn } from "@/lib/utils";

/**
 * Fetches the JSON export (to surface rate limit and load errors), then saves it as a file.
 * `selection` holds the search and column filter params, the export then only has the matching rows.
 */
export function OpenDataDownloadButton({
  dataset,
  variant = "primary",
  selection = "",
}: {
  dataset: OpenDataDataset;
  variant?: "primary" | "secondary";
  selection?: string;
}) {
  const t = useTranslations("openData");
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const response = await fetch(`/api/opendata/${dataset}/export${selection ? `?${selection}` : ""}`);
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: OpenDataErrorCode };
        toast.error(t(`errors.${body.error ?? "internal_error"}`));
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      // The server name says whether it really filtered the rows.
      const serverName = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1];
      anchor.download = serverName ?? openDataExportFileName(dataset, selection !== "", new Date().toISOString().slice(0, 10));
      anchor.click();
      // Revoking in the same tick can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast.success(t("download.success"));
    } catch {
      toast.error(t("errors.network"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-busy={loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[9px] px-3.5 py-2 text-[13px] font-semibold transition-all active:scale-[0.97] disabled:cursor-wait disabled:opacity-70",
        variant === "primary"
          ? "bg-[#e4ae22] text-[#0e0e0e] hover:bg-[#f0bc33]"
          : "border border-neutral-700 bg-[var(--gcs-surface-2)] text-neutral-200 hover:bg-[var(--gcs-hover)]",
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      {loading ? t("download.preparing") : selection ? t("download.labelFiltered") : t("download.label")}
    </button>
  );
}

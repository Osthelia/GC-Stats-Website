/**
 * GC-Stats - liquipedia-import-bar
 *
 * Button that reads the Liquipedia pages of a tournament's linked teams and
 * people and opens change requests for the missing data.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { DownloadIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importLiquipediaData, type LiquipediaImportResult } from "@/actions/liquipedia-import";

export function LiquipediaImportBar({ tournamentId }: { tournamentId: number }) {
  const t = useTranslations("admin.tournaments.liquipedia.import");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<Extract<LiquipediaImportResult, { ok: true }> | null>(null);

  function handleImport() {
    startTransition(async () => {
      const response = await importLiquipediaData(tournamentId);
      if (!response.ok) {
        setResult(null);
        toast.error(response.error === "unreachable" ? t("errorUnreachable") : response.error === "busy" ? t("errorBusy") : t("errorInvalid"));
        return;
      }
      setResult(response);
      if (response.created > 0) toast.success(t("created", { count: response.created }));
    });
  }

  const nothing = result && result.created === 0 && result.upToDate === 0 && result.alreadyPending === 0 && result.noPage.length === 0;

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleImport} disabled={isPending}>
          {isPending ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
          {isPending ? t("loading") : t("button")}
        </Button>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>
      {result && (
        <ul className="flex flex-col gap-1 text-sm">
          {nothing && <li>{t("nothing")}</li>}
          {result.created > 0 && <li>{t("created", { count: result.created })}</li>}
          {result.upToDate > 0 && <li>{t("upToDate", { count: result.upToDate })}</li>}
          {result.alreadyPending > 0 && <li>{t("alreadyPending", { count: result.alreadyPending })}</li>}
          {result.noPage.length > 0 && <li className="text-amber-500">{t("noPage", { names: result.noPage.join(", ") })}</li>}
        </ul>
      )}
    </div>
  );
}

/**
 * GC-Stats - liquipedia-export-viewer
 *
 * Liquipedia export page of a tournament: big buttons for the tournament
 * level blocks, and every wikicode (including a clicked match's) opens in a
 * modal, loaded on demand.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { InfoIcon, Loader2, UsersIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { LiquipediaWikicodeBlock } from "@/components/match/liquipedia-wikicode-block";
import { BracketMatchActionProvider, type BracketMatchTarget } from "@/components/tournament/bracket-match-action";
import { loadInfoboxWikicode, loadMatchWikicode, loadParticipantsWikicode, type LiquipediaExportResult } from "@/actions/liquipedia-export";

type View = { kind: "participants" } | { kind: "infobox" } | { kind: "match"; match: BracketMatchTarget };
type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; data: Extract<LiquipediaExportResult, { ok: true }> };

function BigButton({ icon, title, hint, onClick }: { icon: ReactNode; title: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-neutral-800 px-5 py-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#e4ae22]/50 active:scale-[0.98]"
      style={{ background: "var(--gcs-surface-3)" }}
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#e4ae22]/15 text-[#e4ae22]">{icon}</span>
      <span className="min-w-0">
        <span className="block text-base font-black text-neutral-100 group-hover:text-[#e4ae22]">{title}</span>
        <span className="mt-0.5 block text-xs text-neutral-500">{hint}</span>
      </span>
    </button>
  );
}

export function LiquipediaExportViewer({ tournamentId, children }: { tournamentId: number; children: ReactNode }) {
  const t = useTranslations("matchLiquipedia");
  const tBracket = useTranslations("tournamentPage");
  const [view, setView] = useState<View | null>(null);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  // Only the latest request may update the modal.
  const requestId = useRef(0);

  useEffect(() => {
    if (!view) return;
    const id = ++requestId.current;
    setState({ status: "loading" });
    const request =
      view.kind === "participants" ? loadParticipantsWikicode(tournamentId) : view.kind === "infobox" ? loadInfoboxWikicode(tournamentId) : loadMatchWikicode(tournamentId, view.match.id);
    request
      .then((result) => {
        if (id === requestId.current) setState(result.ok ? { status: "ready", data: result } : { status: "error" });
      })
      .catch(() => {
        if (id === requestId.current) setState({ status: "error" });
      });
  }, [view, tournamentId, attempt]);

  const selectMatch = useCallback((match: BracketMatchTarget) => setView({ kind: "match", match }), []);

  const title =
    view?.kind === "participants"
      ? t("participantsTab")
      : view?.kind === "infobox"
        ? t("infoboxTab")
        : view?.kind === "match"
          ? `${view.match.teamA ?? tBracket("tbd")} ${tBracket("vs")} ${view.match.teamB ?? tBracket("tbd")}`
          : "";

  return (
    <BracketMatchActionProvider value={{ onSelect: selectMatch }}>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <BigButton icon={<UsersIcon className="size-6" />} title={t("participantsTab")} hint={t("participantsHint")} onClick={() => setView({ kind: "participants" })} />
        <BigButton icon={<InfoIcon className="size-6" />} title={t("infoboxTab")} hint={t("infoboxHint")} onClick={() => setView({ kind: "infobox" })} />
      </div>

      <h2 className="mt-8 text-sm font-black tracking-[0.2em] text-neutral-500 uppercase">{t("matchesTitle")}</h2>
      <p className="mt-1 text-xs text-neutral-500">{t("matchesHint")}</p>
      <div className="mt-4">{children}</div>

      <Dialog open={view !== null} onOpenChange={(open) => !open && setView(null)}>
        <DialogContent className="rounded-2xl border border-neutral-800 bg-[var(--gcs-surface-2)] p-6 text-neutral-50 shadow-[0_22px_50px_rgba(0,0,0,.72)] ring-0 sm:max-w-3xl">
          <DialogTitle className="text-lg font-black">{title}</DialogTitle>
          <DialogDescription className="text-xs text-neutral-500">{t("utcNote")}</DialogDescription>

          {state.status === "loading" && (
            <div role="status" className="flex h-48 items-center justify-center gap-3 rounded-2xl border border-neutral-800 text-sm text-neutral-400" style={{ background: "var(--gcs-surface-3)" }}>
              <Loader2 className="size-5 animate-spin" />
              {t("modalLoading")}
            </div>
          )}

          {state.status === "error" && (
            <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              {t("modalError")}
              <button
                type="button"
                onClick={() => setAttempt((n) => n + 1)}
                className="cursor-pointer rounded-[9px] border border-red-400/40 px-3 py-1.5 text-xs font-bold transition-colors hover:bg-red-500/15 active:scale-95"
              >
                {t("retry")}
              </button>
            </div>
          )}

          {state.status === "ready" && (
            <div className="flex min-w-0 flex-col gap-3">
              {state.data.unlinkedTeams.length > 0 && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">{t("unlinkedWarning", { teams: state.data.unlinkedTeams.join(", ") })}</p>
              )}
              {state.data.unlinkedPeopleCount > 0 && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">{t("unlinkedPeopleWarning", { count: state.data.unlinkedPeopleCount })}</p>
              )}
              <LiquipediaWikicodeBlock wikicode={state.data.wikicode} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </BracketMatchActionProvider>
  );
}

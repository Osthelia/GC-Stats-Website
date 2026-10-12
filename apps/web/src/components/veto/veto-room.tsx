/**
 * GC-Stats - veto-room
 *
 * Public veto screen of a team (behind its secret link): the action to take
 * on top, the veto steps below, refreshed by polling.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Check, Loader2, Shield, Swords, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeamBadge } from "@/components/home/team-badge";
import { mapSplashUrl } from "@/lib/valorant-maps";
import { cn } from "@/lib/utils";
import type { TeamVetoView } from "@/lib/veto/team-view";
import type { VetoPublicState } from "@/lib/veto/service";
import { VETO_GRACE_SECONDS, type VetoRecord, type VetoSide } from "@/lib/veto/engine";

const POLL_MS = 1000;
const POLL_HIDDEN_MS = 6000;

type PlayBody = { type: "ready"; ready: boolean } | { type: "chooseFirst"; who: "self" | "opponent" } | { type: "play"; kind: "ban" | "pick"; mapName: string } | { type: "play"; kind: "side"; side: VetoSide } | { type: "finished" };

export function VetoRoom({ token, initial }: { token: string; initial: TeamVetoView }) {
  const t = useTranslations("veto");
  const [view, setView] = useState(initial);
  const [pinnedMatchId, setPinnedMatchId] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const clockOffset = useRef(new Date(initial.serverNow).getTime() - Date.now());
  const pinnedRef = useRef(pinnedMatchId);
  pinnedRef.current = pinnedMatchId;

  const refresh = useCallback(async () => {
    try {
      const pinned = pinnedRef.current;
      const response = await fetch(`/api/veto/${encodeURIComponent(token)}${pinned ? `?match=${pinned}` : ""}`, { cache: "no-store" });
      if (!response.ok) return;
      const next = (await response.json()) as TeamVetoView;
      clockOffset.current = new Date(next.serverNow).getTime() - Date.now();
      // A finished pinned match falls back to the team's current one.
      if (pinned && next.matchId !== pinned) setPinnedMatchId(null);
      setView((prev) => (prev.matchId === next.matchId && prev.state?.version === next.state?.version && prev.matches.length === next.matches.length && prev.prevMatchId === next.prevMatchId && prev.nextMatchId === next.nextMatchId ? prev : next));
    } catch {
      // Next tick retries.
    }
  }, [token]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      void refresh();
      timer = setTimeout(tick, document.hidden ? POLL_HIDDEN_MS : POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  async function send(body: PlayBody) {
    if (!view.matchId || pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/veto/${encodeURIComponent(token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ matchId: view.matchId, ...body }) });
      const data = (await response.json().catch(() => ({}))) as { state?: VetoPublicState; error?: string };
      if (!response.ok || !data.state) {
        setError(t(`error.${data.error ?? "unknown"}`));
        await refresh();
        return;
      }
      const state = data.state;
      setView((prev) => ({ ...prev, state }));
    } catch {
      setError(t("error.network"));
    } finally {
      setPending(false);
    }
  }

  const { state, header } = view;

  if (!state || !header) {
    return (
      <Shell tournamentName={view.tournamentName}>
        <p className="rounded-xl border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">{t("noMatch")}</p>
      </Shell>
    );
  }

  const viewerId = view.viewerEntrantId;
  const opponent = viewerId === state.entrantA.id ? state.entrantB : state.entrantA;
  const nameOf = (id: number | null) => (id === state.entrantA.id ? state.entrantA.name : id === state.entrantB.id ? state.entrantB.name : "");
  const remainingMs = state.stepStartedAt && state.timeoutSeconds > 0 ? Math.min(state.timeoutSeconds * 1000, new Date(state.stepStartedAt).getTime() + (state.timeoutSeconds + VETO_GRACE_SECONDS) * 1000 - (now + clockOffset.current)) : null;

  return (
    <Shell tournamentName={view.tournamentName}>
      <MatchBanner header={header} state={state} viewerId={viewerId} />

      <ActionPanel state={state} viewerId={viewerId} opponentName={opponent.name} nameOf={nameOf} pending={pending} remainingMs={remainingMs} onSend={send} />

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <StepsTimeline state={state} nameOf={nameOf} />

      {state.status === "done" && (
        <div className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center">
          {state.notified ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="size-4 text-emerald-500" />
              {t("staffNotified")}
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{t("gameFinishedHint")}</p>
              <Button size="lg" disabled={pending} onClick={() => send({ type: "finished" })}>
                {pending ? <Loader2 className="animate-spin" /> : null}
                {t("gameFinishedButton")}
              </Button>
            </>
          )}
        </div>
      )}

      {(view.prevMatchId !== null || view.nextMatchId !== null) && (
        <div className="flex justify-between gap-2">
          {view.prevMatchId !== null ? (
            <Button variant="outline" onClick={() => setPinnedMatchId(view.prevMatchId)}>
              <ArrowLeft />
              {t("previousMatch")}
            </Button>
          ) : (
            <span />
          )}
          {view.nextMatchId !== null && (
            <Button variant="outline" onClick={() => setPinnedMatchId(view.nextMatchId)}>
              {t("nextMatch")}
              <ArrowRight />
            </Button>
          )}
        </div>
      )}
    </Shell>
  );
}

function Shell({ tournamentName, children }: { tournamentName: string; children: React.ReactNode }) {
  const t = useTranslations("veto");
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{t("title")}</p>
        <h1 className="text-xl font-bold">{tournamentName}</h1>
      </div>
      {children}
    </div>
  );
}

function MatchBanner({ header, state, viewerId }: { header: NonNullable<TeamVetoView["header"]>; state: VetoPublicState; viewerId: number }) {
  const t = useTranslations("veto");
  const format = useFormatter();
  const sides = [
    { side: header.a, entrantId: state.entrantA.id, ready: state.readyA },
    { side: header.b, entrantId: state.entrantB.id, ready: state.readyB },
  ];
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        {sides.map(({ side, entrantId, ready }, index) => (
          <div key={entrantId} className={cn("flex min-w-0 flex-1 items-center gap-3", index === 1 && "flex-row-reverse text-right")}>
            <TeamBadge tag={side.displayName} size={48} logoUrl={side.logoUrl} logoUrlLight={side.logoUrlLight} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{side.displayName}</p>
              <p className="text-xs text-muted-foreground">
                {entrantId === viewerId ? t("you") : t("opponent")}
                {state.status === "waiting" && ready ? ` · ${t("ready")}` : ""}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-col items-center gap-0.5 text-xs text-muted-foreground">
        {header.scheduledAt && <p>{format.dateTime(new Date(header.scheduledAt), { dateStyle: "medium", timeStyle: "short" })}</p>}
        <p className="font-bold">{t("bestOf", { count: state.bestOf })}</p>
      </div>
    </div>
  );
}

function ActionPanel({
  state,
  viewerId,
  opponentName,
  nameOf,
  pending,
  remainingMs,
  onSend,
}: {
  state: VetoPublicState;
  viewerId: number;
  opponentName: string;
  nameOf: (id: number | null) => string;
  pending: boolean;
  remainingMs: number | null;
  onSend: (body: PlayBody) => void;
}) {
  const t = useTranslations("veto");
  const viewerReady = viewerId === state.entrantA.id ? state.readyA : state.readyB;
  const step = state.stepIndex !== null ? state.steps[state.stepIndex] : null;
  const myTurn = step?.entrantId === viewerId;

  if (state.poolError) {
    return <Panel tone="neutral">{t("poolError")}</Panel>;
  }

  if (state.status === "waiting") {
    return (
      <Panel tone="neutral" title={t("waitingTitle")}>
        <p className="text-sm text-muted-foreground">{t("waitingHint")}</p>
        <Button size="lg" variant={viewerReady ? "outline" : "default"} disabled={pending} onClick={() => onSend({ type: "ready", ready: !viewerReady })}>
          {pending ? <Loader2 className="animate-spin" /> : viewerReady ? <Check /> : null}
          {viewerReady ? t("cancelReady") : t("readyButton")}
        </Button>
      </Panel>
    );
  }

  if (state.status === "choosing") {
    if (state.chooserEntrantId === viewerId) {
      return (
        <Panel tone="neutral" title={t("chooseFirstTitle")}>
          <p className="text-sm text-muted-foreground">{t("chooseFirstHint")}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" disabled={pending} onClick={() => onSend({ type: "chooseFirst", who: "self" })}>
              {t("weStart")}
            </Button>
            <Button size="lg" variant="outline" disabled={pending} onClick={() => onSend({ type: "chooseFirst", who: "opponent" })}>
              {t("opponentStarts", { team: opponentName })}
            </Button>
          </div>
        </Panel>
      );
    }
    return <Panel tone="neutral">{t("waitingChoice", { team: nameOf(state.chooserEntrantId) })}</Panel>;
  }

  if (state.status === "done") {
    return <Panel tone="neutral">{t("vetoDone")}</Panel>;
  }

  if (!step) return null;
  const tone = step.kind === "ban" ? "ban" : step.kind === "pick" ? "pick" : "neutral";
  const timer = remainingMs !== null ? <Countdown ms={remainingMs} /> : null;

  if (!myTurn) {
    return (
      <Panel tone={tone} title={t("theirTurn", { team: nameOf(step.entrantId) })} aside={timer}>
        <p className="text-sm text-muted-foreground">{t(`stepWaiting.${step.kind}`)}</p>
      </Panel>
    );
  }

  return (
    <Panel tone={tone} title={t(`yourTurn.${step.kind}`)} aside={timer}>
      {step.kind === "side" ? (
        <div className="grid grid-cols-2 gap-3">
          <SideButton side="atk" disabled={pending} onClick={() => onSend({ type: "play", kind: "side", side: "atk" })} />
          <SideButton side="def" disabled={pending} onClick={() => onSend({ type: "play", kind: "side", side: "def" })} />
        </div>
      ) : (
        <MapGrid maps={state.pool} records={state.records} kind={step.kind} disabled={pending} onChoose={(mapName) => onSend({ type: "play", kind: step.kind as "ban" | "pick", mapName })} />
      )}
    </Panel>
  );
}

function Panel({ tone, title, aside, children }: { tone: "ban" | "pick" | "neutral"; title?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-4",
        tone === "ban" && "border-red-500/50 bg-red-500/5",
        tone === "pick" && "border-blue-500/50 bg-blue-500/5",
        tone === "neutral" && "bg-card"
      )}
    >
      {(title || aside) && (
        <div className="flex items-center justify-between gap-3">
          <h2 className={cn("text-lg font-bold", tone === "ban" && "text-red-500", tone === "pick" && "text-blue-500")}>{title}</h2>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

function Countdown({ ms }: { ms: number }) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return <span className={cn("rounded-md bg-muted px-2 py-1 font-mono text-sm font-bold tabular-nums", seconds <= 10 && "bg-destructive/20 text-destructive")}>{seconds}s</span>;
}

function SideButton({ side, disabled, onClick }: { side: VetoSide; disabled: boolean; onClick: () => void }) {
  const t = useTranslations("veto");
  const Icon = side === "atk" ? Swords : Shield;
  return (
    <Button size="lg" variant="outline" disabled={disabled} onClick={onClick} className="h-16 flex-col gap-1 text-base font-bold">
      <Icon className="size-5" />
      {t(side === "atk" ? "attack" : "defense")}
    </Button>
  );
}

function MapGrid({ maps, records, kind, disabled, onChoose }: { maps: string[]; records: VetoRecord[]; kind: "ban" | "pick"; disabled: boolean; onChoose: (mapName: string) => void }) {
  const used = useMemo(() => new Set(records.map((r) => r.mapName)), [records]);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {maps.map((mapName) => {
        const taken = used.has(mapName);
        return (
          <button
            key={mapName}
            type="button"
            disabled={disabled || taken}
            onClick={() => onChoose(mapName)}
            className={cn(
              "group relative aspect-[16/10] overflow-hidden rounded-lg border-2 border-transparent bg-muted text-left transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              !taken && kind === "ban" && "hover:border-red-500 active:scale-95",
              !taken && kind === "pick" && "hover:border-blue-500 active:scale-95",
              taken && "cursor-not-allowed opacity-30 grayscale"
            )}
          >
            <MapImage mapName={mapName} />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pt-6 pb-1.5 text-sm font-bold text-white">{mapName}</span>
          </button>
        );
      })}
    </div>
  );
}

function MapImage({ mapName }: { mapName: string }) {
  const [failed, setFailed] = useState(false);
  const url = mapSplashUrl(mapName);
  if (!url || failed) return <span className="absolute inset-0 bg-muted" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="absolute inset-0 size-full object-cover" onError={() => setFailed(true)} />;
}

function StepsTimeline({ state, nameOf }: { state: VetoPublicState; nameOf: (id: number | null) => string }) {
  const t = useTranslations("veto");
  const played = state.records.filter((r) => r.type !== "ban");
  let mapActionIndex = 0;

  const items = state.steps.map((step, index) => {
    let record: VetoRecord | undefined;
    const mapIndex = step.mapIndex;
    if (step.kind !== "side") {
      record = state.records.filter((r) => r.type !== "decider")[mapActionIndex++];
    } else if (mapIndex !== null) {
      record = played[mapIndex];
    }
    return { step, index, record, mapIndex };
  });

  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {items.map(({ step, index, record }) => {
        const current = state.stepIndex === index;
        const done = step.kind === "side" ? !!record?.side : !!record;
        return (
          <li
            key={index}
            className={cn(
              "relative flex min-h-24 flex-col justify-between overflow-hidden rounded-lg border p-2 text-xs",
              step.kind === "ban" && "border-red-500/40",
              step.kind === "pick" && "border-blue-500/40",
              current && "ring-2 ring-foreground/60",
              !done && !current && "opacity-60"
            )}
          >
            {step.kind !== "side" && record && <MapImage mapName={record.mapName} />}
            {step.kind !== "side" && record && <span className="absolute inset-0 bg-black/55" />}
            <span className={cn("relative font-bold tracking-wide uppercase", step.kind === "ban" && "text-red-500", step.kind === "pick" && "text-blue-500", record && step.kind !== "side" && "text-white")}>
              {t(`stepLabel.${step.kind}`)}
            </span>
            <span className={cn("relative", record && step.kind !== "side" ? "text-white" : "text-muted-foreground")}>
              {step.entrantId !== null ? nameOf(step.entrantId) : t("toBeDecided")}
            </span>
            <span className={cn("relative font-semibold", record && step.kind !== "side" && "text-white")}>
              {step.kind === "side" ? (record?.side ? t(record.side === "atk" ? "attack" : "defense") : "") : (record?.mapName ?? "")}
            </span>
          </li>
        );
      })}
      {state.records.find((r) => r.type === "decider") && (
        <li className="relative flex min-h-24 flex-col justify-between overflow-hidden rounded-lg border border-foreground/30 p-2 text-xs">
          <MapImage mapName={(state.records.find((r) => r.type === "decider") as VetoRecord).mapName} />
          <span className="absolute inset-0 bg-black/55" />
          <span className="relative font-bold tracking-wide text-white uppercase">{t("stepLabel.decider")}</span>
          <span className="relative font-semibold text-white">{(state.records.find((r) => r.type === "decider") as VetoRecord).mapName}</span>
        </li>
      )}
    </ol>
  );
}

/**
 * GC-Stats - match-poster
 *
 * Fixed 2080 wide composition of a match (header, round history, scoreboard) meant to be
 * captured as an image, its height follows the content. Always dark, no links or hover, sized in px so the capture is stable.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DEFAULT_TEAM_LOGO_DARK } from "@/lib/default-logos";
import { GOLD, tint } from "@/lib/theme-colors";
import { agentIconUrl, winTypeIconUrl } from "@/lib/valorant-agents";
import { mapSplashUrl } from "@/lib/valorant-maps";
import { FormattedDate } from "@/components/formatted-date";
import type { MatchHeader, MatchMap, MatchMapPlayerRow, MatchRound, MatchSide } from "@/lib/match-page-data";

export const POSTER_WIDTH = 2080;

const BLUE = "#3b82f6";
const RED = "#ef4444";
const MAX_ROUNDS_PER_LINE = 30;
const MAX_AGENTS = 5;
const AGENT_OVERLAP = 14;
const HALF_LENGTH = 12;
const REGULATION_LENGTH = 24;
const MUTED = "#8a8a94";
const FAINT = "#5a5a64";

const GRID_COLS = "140px minmax(0,1fr) 76px 170px 70px 76px 84px 70px 2px 70px 84px 76px 70px 170px 76px minmax(0,1fr) 140px";

/** Everything the poster needs, as returned by /api/match-poster/[matchId]. */
export type PosterData = {
  match: Omit<MatchHeader, "scheduledAt"> & { scheduledAt: string | null };
  maps: MatchMap[];
  aggregated: { playersA: MatchMapPlayerRow[]; playersB: MatchMapPlayerRow[] };
  roundsByMapId: Record<number, MatchRound[]>;
};

/** Storage bucket logos go through the same origin relay so the capture can read their pixels. */
function assetSrc(url: string): string {
  return /^https?:\/\//i.test(url) ? `/api/poster-asset?u=${encodeURIComponent(url)}` : url;
}

function PosterLogo({ url, alt, size }: { url: string | null; alt: string; size: number }) {
  const [failed, setFailed] = useState(false);
  const src = failed || !url ? DEFAULT_TEAM_LOGO_DARK : assetSrc(url);
  return <img src={src} alt={alt} width={size} height={size} style={{ width: size, height: size }} className="object-contain" onError={() => setFailed(true)} />;
}

function PosterAgent({ agent, overlap }: { agent: string; overlap: boolean }) {
  const [failed, setFailed] = useState(false);
  const box = "h-[36px] w-[36px] flex-none rounded-md border border-white/10 bg-[#1c1c1c] ring-2 ring-[#111111]";
  const style = overlap ? { marginLeft: -AGENT_OVERLAP } : undefined;
  if (failed) return <span style={style} className={`${box} flex items-center justify-center text-[15px] font-black text-white/40 uppercase`}>{agent.slice(0, 1)}</span>;
  return <img src={agentIconUrl(agent)} alt={agent} width={36} height={36} style={style} className={`${box} object-contain`} onError={() => setFailed(true)} />;
}

function scoreLabel(score: number | null, entrantId: number | null, fallback = "–"): string | number {
  if (score === -1) return entrantId == null ? "BYE" : "FF";
  return score ?? fallback;
}

function isPlayed(m: MatchMap): boolean {
  return m.isCompleted && m.teamAScore != null && m.teamBScore != null && !(m.teamAScore === -1 && m.teamBScore === -1);
}

function agentsOf(p: MatchMapPlayerRow): string[] {
  return p.agents.length ? p.agents : p.agentName ? [p.agentName] : [];
}

function TeamHead({ side, name, align }: { side: MatchSide; name: string; align: "left" | "right" }) {
  const logo = <PosterLogo url={side.logoUrl} alt={name} size={80} />;
  return (
    <div className="flex min-w-0 items-center gap-5">
      {align === "right" && logo}
      <div className={`min-w-0 flex-1 ${align === "left" ? "text-right" : "text-left"}`}>
        <div className="text-[40px] leading-[1.05] font-black tracking-tight break-words text-[#f2f2f2] italic">{name}</div>
      </div>
      {align === "left" && logo}
    </div>
  );
}

function PosterHeader({ data, map, teamAName, teamBName }: { data: PosterData; map: MatchMap | null; teamAName: string; teamBName: string }) {
  const { match } = data;
  const scoreA = map ? map.teamAScore : match.scoreA;
  const scoreB = map ? map.teamBScore : match.scoreB;
  const fallback = match.status === "completed" || map ? "–" : "0";
  const leadA = (scoreA ?? 0) > (scoreB ?? 0);
  const leadB = (scoreB ?? 0) > (scoreA ?? 0);
  const playedMaps = data.maps.filter(isPlayed);
  const splash = map ? mapSplashUrl(map.mapName) : null;

  return (
    <header className="relative flex flex-none flex-col overflow-hidden rounded-2xl border border-neutral-800 px-10 py-6" style={{ background: "#171717" }}>
      {splash ? (
        <>
          <img src={splash} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(14,14,14,0.55) 0%, rgba(14,14,14,0.8) 100%)" }} />
        </>
      ) : (
        <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(760px 200px at 50% 0%, ${tint(GOLD, 0.1)}, transparent 65%)` }} />
      )}

      <div className="pointer-events-none absolute top-1/2 -left-20 -translate-y-1/2 opacity-[0.13]">
        <PosterLogo url={match.a.logoUrl} alt="" size={440} />
      </div>
      <div className="pointer-events-none absolute top-1/2 -right-20 -translate-y-1/2 opacity-[0.13]">
        <PosterLogo url={match.b.logoUrl} alt="" size={440} />
      </div>

      <div className="relative flex flex-col items-center gap-1 text-center">
        <span className="font-mono text-[18px] font-bold tracking-widest text-neutral-300 uppercase">{match.tournamentName}</span>
        <span className="font-mono text-[15px]" style={{ color: splash ? MUTED : FAINT }}>{match.stageName}</span>
      </div>

      <div className="relative mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
        <TeamHead side={match.a} name={teamAName} align="left" />

        <div className="flex flex-col items-center gap-1">
          {map && (
            <span className="rounded-md px-3 py-0.5 font-mono text-[15px] font-black tracking-widest uppercase" style={{ background: GOLD, color: "#000" }}>
              {map.mapName}
            </span>
          )}
          <div className="flex items-center font-mono text-[68px] leading-none font-black tracking-tighter tabular-nums">
            <span style={{ color: leadA ? GOLD : "#f2f2f2" }}>{scoreLabel(scoreA, match.a.entrantId, fallback)}</span>
            <span className="mx-4 text-neutral-600">–</span>
            <span style={{ color: leadB ? GOLD : "#f2f2f2" }}>{scoreLabel(scoreB, match.b.entrantId, fallback)}</span>
          </div>
        </div>

        <TeamHead side={match.b} name={teamBName} align="right" />
      </div>

      {!map && playedMaps.length > 0 && (
        <div className="relative mt-5 flex justify-center gap-4">
          {playedMaps.map((m) => (
            <div key={m.id} className="relative flex items-center gap-4 overflow-hidden rounded-full border border-white/10 bg-white/5 px-8 py-2.5 font-mono text-[24px] font-black tracking-widest uppercase">
              {mapSplashUrl(m.mapName) && (
                <>
                  <img src={mapSplashUrl(m.mapName)!} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
                  <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(14,14,14,0.75) 0%, rgba(14,14,14,0.45) 100%)" }} />
                </>
              )}
              <span className="relative text-white">{m.mapName}</span>
              <span className="relative" style={{ color: GOLD }}>
                {scoreLabel(m.teamAScore, match.a.entrantId)}–{scoreLabel(m.teamBScore, match.b.entrantId)}
              </span>
            </div>
          ))}
        </div>
      )}
    </header>
  );
}

function StatCell({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`text-center font-mono text-[19px] font-bold ${className}`} style={style}>
      {children}
    </div>
  );
}

function PlayerStats({ p, mirrored, mvp }: { p: MatchMapPlayerRow | null; mirrored: boolean; mvp: boolean }) {
  const t = useTranslations("matchPage");
  if (!p) return Array.from({ length: 7 }).map((_, i) => <div key={i} aria-hidden />);

  const agents = (
    <div key="agents" className={`flex ${mirrored ? "justify-end" : ""}`}>
      {agentsOf(p)
        .slice(0, MAX_AGENTS)
        .map((agent, i) => (
          <PosterAgent key={agent} agent={agent} overlap={i > 0} />
        ))}
    </div>
  );
  const name = (
    <div key="name" className={`flex min-w-0 items-center gap-2 ${mirrored ? "flex-row-reverse" : "-ml-1.5"}`}>
      <span className={`min-w-0 truncate text-[21px] font-black text-white uppercase italic ${mirrored ? "pr-1.5" : "pr-2"}`}>{p.handle}</span>
      {mvp && <span className="flex-none rounded px-1.5 py-px text-[11px] font-black text-black uppercase" style={{ background: GOLD }}>{t("mvp")}</span>}
    </div>
  );
  const cells = [
    <StatCell key="acs" className="text-white">{p.acs}</StatCell>,
    <StatCell key="kda" className="whitespace-nowrap">
      <span className="text-white">{p.kills}</span>
      <span className="mx-1" style={{ color: FAINT }}>/</span>
      <span style={{ color: "#f87171" }}>{p.deaths}</span>
      <span className="mx-1" style={{ color: FAINT }}>/</span>
      <span style={{ color: MUTED }}>{p.assists}</span>
    </StatCell>,
    <StatCell key="adr" className="text-white/80">{p.adr}</StatCell>,
    <StatCell key="kast" className="text-white/80">{Math.round(p.kastPercentage)}%</StatCell>,
    <StatCell key="fk" style={{ color: p.firstKills > p.firstDeaths ? "#4ade80" : MUTED }}>
      {p.firstKills}-{p.firstDeaths}
    </StatCell>,
    <StatCell key="hs" style={{ color: MUTED }}>{Math.round(p.headshotPercentage)}%</StatCell>,
  ];
  // Right side mirrors the left, so the stat order flips and the player column hugs the edge.
  return mirrored ? [...cells.reverse(), name, agents] : [agents, name, ...cells];
}

function PosterScoreboard({ playersA, playersB, nameA, nameB }: { playersA: MatchMapPlayerRow[]; playersB: MatchMapPlayerRow[]; nameA: string; nameB: string }) {
  const t = useTranslations("matchPage");
  const rows = Math.max(playersA.length, playersB.length);
  const maxAcs = playersA.concat(playersB).reduce<number | null>((max, s) => (max == null || s.acs > max ? s.acs : max), null);
  const label = "text-center font-mono text-[14px] font-black tracking-widest uppercase";
  const labels = [t("colAcs"), "K/D/A", t("colAdr"), `${t("colKast")}%`, "FK-FD", "HS%"];

  return (
    <section className="flex flex-none flex-col overflow-hidden rounded-2xl border border-neutral-800" style={{ background: "#111111" }}>
      <div className="grid flex-none items-center gap-x-3 border-b border-white/10 px-8 py-3" style={{ gridTemplateColumns: GRID_COLS, color: MUTED }}>
        <div className="col-span-2 truncate text-[17px] font-black tracking-wide uppercase" style={{ color: "#d4d4d4" }}>{nameA}</div>
        {labels.map((l) => (
          <div key={`a${l}`} className={label}>{l}</div>
        ))}
        <div aria-hidden />
        {[...labels].reverse().map((l) => (
          <div key={`b${l}`} className={label}>{l}</div>
        ))}
        <div className="col-span-2 truncate text-right text-[17px] font-black tracking-wide uppercase" style={{ color: "#d4d4d4" }}>{nameB}</div>
      </div>

      <div className="flex flex-col">
        {Array.from({ length: rows }).map((_, i) => {
          const left = playersA[i] ?? null;
          const right = playersB[i] ?? null;
          return (
            <div key={i} className="grid h-[62px] items-center gap-x-3 px-8" style={{ gridTemplateColumns: GRID_COLS, background: i % 2 === 1 ? "rgba(255,255,255,0.025)" : undefined }}>
              <PlayerStats p={left} mirrored={false} mvp={left != null && left.acs === maxAcs} />
              <div aria-hidden className="h-3/5 w-px justify-self-center bg-white/10" />
              <PlayerStats p={right} mirrored mvp={right != null && right.acs === maxAcs} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RoundCell({ round, entrantId, color, numberBelow }: { round: MatchRound; entrantId: number | null; color: string; numberBelow: boolean }) {
  const won = entrantId != null && round.winningEntrantId === entrantId;
  const number = (
    <span className="font-mono text-[12px] leading-none font-black" style={{ color: round.roundNumber > REGULATION_LENGTH ? GOLD : FAINT }}>
      {String(round.roundNumber).padStart(2, "0")}
    </span>
  );
  return (
    <div className="relative flex flex-col items-center gap-1">
      {!numberBelow && number}
      <div
        className="flex aspect-square w-full max-w-[44px] items-center justify-center rounded-lg border"
        style={won ? { borderColor: tint(color, 0.5), background: tint(color, 0.14) } : { borderColor: "rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.35)", opacity: 0.45 }}
      >
        {won && <img src={winTypeIconUrl(round.winType)} alt={round.winType ?? "timeout"} className="h-3/4 w-3/4 object-contain brightness-110" />}
      </div>
      {numberBelow && number}
      {round.roundNumber === HALF_LENGTH && <div className="absolute top-0 -right-[7px] bottom-0 w-px bg-white/15" />}
      {round.roundNumber === REGULATION_LENGTH && <div className="absolute top-0 -right-[7px] bottom-0 w-px" style={{ background: tint(GOLD, 0.5) }} />}
    </div>
  );
}

function PosterRoundHistory({ rounds, a, b }: { rounds: MatchRound[]; a: MatchSide; b: MatchSide }) {
  const t = useTranslations("matchPage");
  if (rounds.length === 0) return null;
  const lineSize = Math.max(REGULATION_LENGTH, Math.min(rounds.length, MAX_ROUNDS_PER_LINE));
  const lines: MatchRound[][] = [];
  for (let i = 0; i < rounds.length; i += lineSize) lines.push(rounds.slice(i, i + lineSize));

  const row = (side: MatchSide, color: string, numberBelow: boolean) =>
    lines.map((line, i) => (
      <div key={i} className="flex items-center gap-5">
        <div className={`flex h-[68px] w-[68px] flex-none items-center justify-center rounded-xl border ${i > 0 ? "invisible" : ""}`} style={{ borderColor: tint(color, 0.5), background: tint(color, 0.12) }}>
          <PosterLogo url={side.logoUrl} alt={side.displayName} size={50} />
        </div>
        <div className="grid min-w-0 flex-1 gap-[14px]" style={{ gridTemplateColumns: `repeat(${lineSize}, minmax(0, 1fr))`, alignItems: numberBelow ? "start" : "end" }}>
          {line.map((round) => (
            <RoundCell key={round.roundNumber} round={round} entrantId={side.entrantId} color={color} numberBelow={numberBelow} />
          ))}
        </div>
      </div>
    ));

  return (
    <section className="flex flex-none flex-col gap-3 overflow-hidden rounded-2xl border border-neutral-800 px-8 py-5" style={{ background: "#111111" }} aria-label={t("roundHistory")}>
      <div className="flex flex-col gap-2">{row(a, BLUE, false)}</div>
      <div className="h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <div className="flex flex-col gap-2">{row(b, RED, true)}</div>
    </section>
  );
}

function PosterFooter({ url }: { url: string }) {
  const [logoFailed, setLogoFailed] = useState(false);
  return (
    <footer className="flex flex-none items-center justify-between px-4 font-mono text-[22px] font-bold tracking-[0.2em] uppercase" style={{ color: MUTED }}>
      <span className="flex items-center gap-3">
        {!logoFailed && <img src="/favicon.svg" alt="" className="h-[30px] w-[30px]" onError={() => setLogoFailed(true)} />}
        <span style={{ color: GOLD }}>GC Stats</span>
      </span>
      <span className="tracking-widest normal-case">{url}</span>
    </footer>
  );
}

export function MatchPoster({ data, mapId, url, watermark }: { data: PosterData; mapId: number | null; url: string; watermark: boolean }) {
  const t = useTranslations("matchPage");
  const { match } = data;
  const map = mapId != null ? (data.maps.find((m) => m.id === mapId) ?? null) : null;
  const fallbackName = match.status === "completed" ? t("teamBye") : t("teamTbd");
  const teamAName = match.a.entrantId != null ? match.a.displayName : fallbackName;
  const teamBName = match.b.entrantId != null ? match.b.displayName : fallbackName;
  const playersA = map ? map.playersA : data.aggregated.playersA;
  const playersB = map ? map.playersB : data.aggregated.playersB;

  return (
    <div className="flex flex-col gap-6 overflow-hidden px-10 py-8" style={{ width: POSTER_WIDTH, background: "#0e0e0e", color: "#fff" }}>
      <PosterHeader data={data} map={map} teamAName={teamAName} teamBName={teamBName} />
      {map && <PosterRoundHistory rounds={data.roundsByMapId[map.id] ?? []} a={match.a} b={match.b} />}
      <PosterScoreboard playersA={playersA} playersB={playersB} nameA={teamAName} nameB={teamBName} />
      {watermark && <PosterFooter url={url} />}
    </div>
  );
}

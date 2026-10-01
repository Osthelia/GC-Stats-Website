/**
 * GC-Stats - match-team-stats-table
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { teamLogo, teamLogoLight } from "@/lib/home-fake-data";
import { slugify } from "@/lib/entity-id";
import { AgentIcon } from "@/components/match/agent-icon";
import type { MatchMapPlayerRow, MatchSide } from "@/lib/match-page-data";
import { ThemedLogoImage } from "@/components/site/themed-logo-image";

const GRID_COLS = "100px 160px minmax(16px,1fr) 44px 82px 42px 42px 54px 38px 16px 38px 54px 42px 42px 82px 44px minmax(16px,1fr) 160px 100px";
const GRID_COLS_MOBILE = "32px minmax(90px,140px) 36px 66px 34px 34px 46px 32px";

function fkColor(fk: number, fd: number): string {
  return fk > fd ? "text-green-400" : "text-neutral-400";
}

function PlayerLink({ p, children, className }: { p: MatchMapPlayerRow; children: React.ReactNode; className?: string }) {
  if (p.personId == null || p.isGhost) return <span className={className}>{children}</span>;
  return (
    <Link href={`/player/${p.personId}/${slugify(p.handle)}`} className={className}>
      {children}
    </Link>
  );
}

export function MatchTeamStatsTable({
  statsA,
  statsB,
  a,
  b,
  teamAName,
  teamBName,
}: {
  statsA: MatchMapPlayerRow[];
  statsB: MatchMapPlayerRow[];
  a: MatchSide;
  b: MatchSide;
  teamAName: string;
  teamBName: string;
}) {
  const t = useTranslations("matchPage");
  const logoA = a.logoUrl ?? teamLogo(a.shortName ?? "");
  const logoALight = a.logoUrlLight ?? a.logoUrl ?? teamLogoLight(a.shortName ?? "");
  const logoB = b.logoUrl ?? teamLogo(b.shortName ?? "");
  const logoBLight = b.logoUrlLight ?? b.logoUrl ?? teamLogoLight(b.shortName ?? "");
  const rowCount = Math.max(statsA.length, statsB.length);
  const maxAcs = statsA.concat(statsB).reduce<number | null>((max, s) => (max == null || s.acs > max ? s.acs : max), null);

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-neutral-800" style={{ background: "var(--gcs-surface-2)" }}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-neutral-800 px-5 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-800" style={{ background: "var(--gcs-surface-2)" }}>
            <ThemedLogoImage dark={logoA} light={logoALight} alt={teamAName} width={28} height={28} className="h-6 w-6 object-contain" />
          </div>
          <span className="truncate text-sm font-black text-[var(--gcs-text)] italic">{teamAName}</span>
        </div>
        <span className="shrink-0 px-2 font-mono text-[11px] font-bold tracking-[0.3em] text-neutral-600 uppercase">{t("vs")}</span>
        <div className="flex min-w-0 items-center justify-end gap-2.5">
          <span className="truncate text-sm font-black text-[var(--gcs-text)] italic">{teamBName}</span>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-800" style={{ background: "var(--gcs-surface-2)" }}>
            <ThemedLogoImage dark={logoB} light={logoBLight} alt={teamBName} width={28} height={28} className="h-6 w-6 object-contain" />
          </div>
        </div>
      </div>

      <div className="no-scrollbar hidden w-full overflow-x-auto md:block">
        <div className="w-full min-w-[1180px]">
          <div className="grid gap-5 border-b border-neutral-800 px-3 py-2 text-[10px] font-black tracking-wide text-neutral-500 uppercase" style={{ gridTemplateColumns: GRID_COLS }}>
            <div>{t("colAgent")}</div>
            <div>{t("colPlayer")}</div>
            <div aria-hidden />
            <div className="text-center" title={t("acsFull")}>
              {t("colAcs")}
            </div>
            <div className="text-center text-neutral-300">K/D/A</div>
            <div className="text-center" title={t("adrFull")}>
              {t("colAdr")}
            </div>
            <div className="text-center" title={t("kastFull")}>
              {t("colKast")}%
            </div>
            <div className="text-center">FK-FD</div>
            <div className="text-center">HS%</div>
            <div aria-hidden />
            <div className="text-center">HS%</div>
            <div className="text-center">FK-FD</div>
            <div className="text-center" title={t("kastFull")}>
              {t("colKast")}%
            </div>
            <div className="text-center" title={t("adrFull")}>
              {t("colAdr")}
            </div>
            <div className="text-center text-neutral-300">K/D/A</div>
            <div className="text-center" title={t("acsFull")}>
              {t("colAcs")}
            </div>
            <div aria-hidden />
            <div className="text-right">{t("colPlayer")}</div>
            <div className="text-right">{t("colAgent")}</div>
          </div>

          <div className="divide-y divide-neutral-900">
            {Array.from({ length: rowCount }).map((_, i) => {
              const left = statsA[i] ?? null;
              const right = statsB[i] ?? null;
              const leftAgents = left ? (left.agents.length ? left.agents : left.agentName ? [left.agentName] : []) : [];
              const rightAgents = right ? (right.agents.length ? right.agents : right.agentName ? [right.agentName] : []) : [];

              return (
                <div key={i} className={`grid items-center gap-5 px-3 py-2.5 transition-colors hover:bg-white/[0.025] ${i % 2 === 1 ? "bg-white/[0.02]" : ""}`} style={{ gridTemplateColumns: GRID_COLS }}>
                  <div className="flex flex-wrap gap-1.5">
                    {leftAgents.map((agent, ai) => (
                      <AgentIcon key={ai} agent={agent} size="h-7 w-7" />
                    ))}
                  </div>

                  <div className="min-w-0 text-[13px] font-black text-[var(--gcs-text)] uppercase italic">
                    {left && (
                      <div className="flex min-w-0 items-center gap-2">
                        <PlayerLink p={left} className="min-w-0 truncate px-1 transition-colors hover:text-[#e4ae22]">
                          {left.handle}
                        </PlayerLink>
                        {maxAcs != null && left.acs === maxAcs && <span className="shrink-0 rounded bg-[#e4ae22] px-1.5 py-0.5 text-[9px] font-black text-black uppercase">{t("mvp")}</span>}
                      </div>
                    )}
                  </div>

                  <div aria-hidden />
                  <div className="text-center font-mono text-[13px] font-bold text-neutral-300">{left?.acs ?? ""}</div>
                  <div className="text-center text-[12.5px] whitespace-nowrap tabular-nums">
                    {left && (
                      <>
                        <span className="font-black text-[var(--gcs-text)]">{left.kills}</span>
                        <span className="mx-0.5 text-neutral-700">/</span>
                        <span className="font-black text-red-500/70">{left.deaths}</span>
                        <span className="mx-0.5 text-neutral-700">/</span>
                        <span className="font-black text-neutral-500">{left.assists}</span>
                      </>
                    )}
                  </div>
                  <div className="text-center text-[12.5px] text-neutral-300">{left?.adr ?? ""}</div>
                  <div className="text-center text-[12.5px] font-semibold text-neutral-300">{left ? `${Math.round(left.kastPercentage)}%` : ""}</div>
                  <div className={`text-center text-[12.5px] font-semibold ${left ? fkColor(left.firstKills, left.firstDeaths) : "text-neutral-600"}`}>{left ? `${left.firstKills}-${left.firstDeaths}` : ""}</div>
                  <div className="text-center text-[12.5px] text-neutral-400">{left ? `${Math.round(left.headshotPercentage)}%` : ""}</div>

                  <div aria-hidden className="h-full w-px justify-self-center bg-white/5" />

                  <div className="text-center text-[12.5px] text-neutral-400">{right ? `${Math.round(right.headshotPercentage)}%` : ""}</div>
                  <div className={`text-center text-[12.5px] font-semibold ${right ? fkColor(right.firstKills, right.firstDeaths) : "text-neutral-600"}`}>{right ? `${right.firstKills}-${right.firstDeaths}` : ""}</div>
                  <div className="text-center text-[12.5px] font-semibold text-neutral-300">{right ? `${Math.round(right.kastPercentage)}%` : ""}</div>
                  <div className="text-center text-[12.5px] text-neutral-300">{right?.adr ?? ""}</div>
                  <div className="text-center text-[12.5px] whitespace-nowrap tabular-nums">
                    {right && (
                      <>
                        <span className="font-black text-[var(--gcs-text)]">{right.kills}</span>
                        <span className="mx-0.5 text-neutral-700">/</span>
                        <span className="font-black text-red-500/70">{right.deaths}</span>
                        <span className="mx-0.5 text-neutral-700">/</span>
                        <span className="font-black text-neutral-500">{right.assists}</span>
                      </>
                    )}
                  </div>
                  <div className="text-center font-mono text-[13px] font-bold text-neutral-300">{right?.acs ?? ""}</div>
                  <div aria-hidden />

                  <div className="min-w-0 text-right text-[13px] font-black text-[var(--gcs-text)] uppercase italic">
                    {right && (
                      <div className="flex min-w-0 items-center justify-end gap-2">
                        {maxAcs != null && right.acs === maxAcs && <span className="shrink-0 rounded bg-[#e4ae22] px-1.5 py-0.5 text-[9px] font-black text-black uppercase">{t("mvp")}</span>}
                        <PlayerLink p={right} className="min-w-0 truncate px-1 transition-colors hover:text-[#e4ae22]">
                          {right.handle}
                        </PlayerLink>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap justify-end gap-1.5">
                    {rightAgents.map((agent, ai) => (
                      <AgentIcon key={ai} agent={agent} size="h-7 w-7" />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="divide-y divide-neutral-800 md:hidden">
        {[
          { name: teamAName, stats: statsA },
          { name: teamBName, stats: statsB },
        ].map((team) => (
          <div key={team.name} className="py-3">
            <div className="mb-2 px-3 text-center text-[13px] font-black tracking-wide text-[var(--gcs-text)] uppercase italic">{team.name}</div>
            <div className="no-scrollbar overflow-x-auto">
              <div className="min-w-[420px] px-3">
                <div className="grid items-center gap-2 pb-1.5 text-[9px] font-black tracking-wide text-neutral-500 uppercase" style={{ gridTemplateColumns: GRID_COLS_MOBILE }}>
                  <div />
                  <div>{t("colPlayer")}</div>
                  <div className="text-center">{t("colAcs")}</div>
                  <div className="text-center text-neutral-300">K/D/A</div>
                  <div className="text-center">{t("colAdr")}</div>
                  <div className="text-center">{t("colKast")}%</div>
                  <div className="text-center">FK-FD</div>
                  <div className="text-center">HS%</div>
                </div>
                <div>
                  {team.stats.map((s, i) => {
                    const agents = s.agents.length ? s.agents : s.agentName ? [s.agentName] : [];
                    const isMvp = maxAcs != null && s.acs === maxAcs;
                    return (
                      <div
                        key={i}
                        className={`-ml-2 grid items-center gap-2 py-2 pl-2 ${isMvp ? "border-l-2 border-[#e4ae22]" : ""}`}
                        style={{ gridTemplateColumns: GRID_COLS_MOBILE }}
                      >
                        <div className="flex flex-wrap gap-1">
                          {agents.map((agent, ai) => (
                            <AgentIcon key={ai} agent={agent} size="h-6 w-6" />
                          ))}
                        </div>
                        <div className="min-w-0 text-[12px] font-black text-[var(--gcs-text)] uppercase italic">
                          <PlayerLink p={s} className="block min-w-0 truncate px-1 transition-colors hover:text-[#e4ae22]">
                            {s.handle}
                          </PlayerLink>
                        </div>
                        <div className="text-center font-mono text-[12px] font-bold text-neutral-300">{s.acs}</div>
                        <div className="text-center text-[11px] whitespace-nowrap">
                          <span className="font-black text-[var(--gcs-text)]">{s.kills}</span>
                          <span className="mx-0.5 text-neutral-700">/</span>
                          <span className="font-black text-red-500/70">{s.deaths}</span>
                          <span className="mx-0.5 text-neutral-700">/</span>
                          <span className="font-black text-neutral-500">{s.assists}</span>
                        </div>
                        <div className="text-center text-[11px] text-neutral-300">{s.adr}</div>
                        <div className="text-center text-[11px] font-semibold text-neutral-300">{Math.round(s.kastPercentage)}%</div>
                        <div className={`text-center text-[11px] font-semibold ${fkColor(s.firstKills, s.firstDeaths)}`}>
                          {s.firstKills}-{s.firstDeaths}
                        </div>
                        <div className="text-center text-[11px] text-neutral-400">{Math.round(s.headshotPercentage)}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

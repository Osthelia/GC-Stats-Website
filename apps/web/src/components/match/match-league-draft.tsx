/**
 * GC-Stats - match-league-draft
 *
 * A game's draft: one row per team, in draft order. A run of bans shares its columns between the two rows: each team's
 * n-th ban is in the same column as the other team's n-th ban. A run of picks has one column per pick, so the picks are
 * staggered. A ban is greyed out and crossed by a line in the team's side colour; a pick is shown as it is. On the page
 * the icons follow the breakpoint: from lg the team name sits in a column on the left of its row, below it goes above
 * the row. On phones each team is a block of two short lines, its bans and its picks, with a bar between the ban phases and between the turns of the picks.
 * The poster has the team names in a column on the left and a fixed icon size. Shared by the match page and the poster.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { Fragment } from "react";
import { useTranslations } from "next-intl";
import { LolIcon } from "@/components/match/lol-icon";
import type { LeagueGameDraft } from "@/lib/match-league-games";

type DraftStep = LeagueGameDraft["steps"][number];
/** One column of the draft: the step of each team in it, if any. */
type Column = Partial<Record<DraftStep["side"], DraftStep>>;

/** The page sizes its icons in CSS (`--lol-icon`, set on the draft), so they follow the breakpoints. The poster is fixed. */
const ICON_SIZE = { page: "var(--lol-icon)", poster: 72 } as const;

function BanOrPick({ step, color, size }: { step: DraftStep; color: string; size: number | string }) {
  const ban = step.type === "ban";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className={ban ? "grayscale opacity-60" : ""}>
        <LolIcon kind="champion" url={step.iconUrl} name={step.championName} size={size} />
      </div>
      {ban && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 64 64" preserveAspectRatio="none" aria-hidden="true">
          <line x1="10" y1="54" x2="54" y2="10" stroke={color} strokeWidth="2" />
        </svg>
      )}
    </div>
  );
}

/**
 * The columns in draft order, grouped by run of the same step type. The n-th ban of each team shares column n of its run;
 * each pick is a column of its own.
 */
function draftGroups(steps: DraftStep[]): Column[][] {
  const runs: DraftStep[][] = [];
  for (const step of steps) {
    const run = runs[runs.length - 1];
    if (run && run[0]!.type === step.type) run.push(step);
    else runs.push([step]);
  }
  return runs.map((run) => {
    if (run[0]!.type === "pick") return run.map((step): Column => (step.side === "blue" ? { blue: step } : { red: step }));
    const blue = run.filter((step) => step.side === "blue");
    const red = run.filter((step) => step.side === "red");
    return Array.from({ length: Math.max(blue.length, red.length) }, (_, n): Column => ({ blue: blue[n], red: red[n] }));
  });
}

/** A team's picks in runs: a run ends where the other team picks, so the picks of one turn stay together. */
function pickRuns(picks: DraftStep[], side: DraftStep["side"]): DraftStep[][] {
  const runs: DraftStep[][] = [];
  let previous = -2;
  picks.forEach((step, k) => {
    if (step.side !== side) return;
    if (k === previous + 1) runs[runs.length - 1]!.push(step);
    else runs.push([step]);
    previous = k;
  });
  return runs;
}

export function LeagueDraft({ draft, blueName, redName, look = "page" }: { draft: LeagueGameDraft; blueName: string; redName: string; look?: "page" | "poster" }) {
  const t = useTranslations("matchPage");
  const teams = [
    { side: "blue" as const, name: blueName, tone: "text-blue-400", color: "#5a7cb4" },
    { side: "red" as const, name: redName, tone: "text-red-400", color: "#b65a5a" },
  ];
  const steps = [...draft.steps].sort((x, y) => x.step - y.step);
  const groups = draftGroups(steps);
  const picks = steps.filter((step) => step.type === "pick");
  const size = ICON_SIZE[look];
  const poster = look === "poster";

  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-neutral-800 [--lol-icon:36px] lg:[--lol-icon:48px] xl:[--lol-icon:64px]">
      {teams.map((team, i) => {
        // The team's bans by phase and its picks by turn, for the phone layout.
        const phones = {
          ban: groups.map((group) => group.flatMap((column) => column[team.side] ?? [])).filter((phase) => phase[0]?.type === "ban"),
          pick: pickRuns(picks, team.side),
        };
        const border = i === 0 ? "border-b border-neutral-800" : "";
        const name = <span className={`text-sm font-black tracking-wide uppercase ${team.tone}`}>{team.name}</span>;
        return (
          <div key={team.side} className={border} style={{ background: "#111111" }}>
            <div className={poster ? "flex flex-row items-center px-6" : "hidden px-6 py-3 md:flex md:flex-col lg:flex-row lg:items-center"}>
              <div className={poster ? "w-1/5 py-3" : "flex-none pb-2 lg:w-fit md:text-center lg:pb-0 lg:text-left"}>{name}</div>
              <div className="flex w-full flex-row md:justify-center lg:justify-end gap-x-4 pl-2">
                {groups.map((group, g) => (
                  <ul key={g} className="flex flex-row gap-0.5">
                    {group.map((column, n) => {
                      const step = column[team.side];
                      return <li key={n}>{step ? <BanOrPick step={step} color={team.color} size={size} /> : <div style={{ width: size, height: size }} />}</li>;
                    })}
                  </ul>
                ))}
              </div>
            </div>
            {!poster && (
              <div className="px-3 py-3 md:hidden">
                {name}
                {(["ban", "pick"] as const).map((type) => (
                  <div key={type} className="mt-2 flex items-center gap-3">
                    <span className="w-10 flex-none text-xs font-bold tracking-wide text-neutral-500 uppercase">{t(type)}</span>
                    <div className="flex items-center gap-0.5">
                      {phones[type].map((phase, p) => (
                        <Fragment key={p}>
                          {p > 0 && <span className="mx-1.5 h-6 w-px bg-neutral-700" aria-hidden />}
                          {phase.map((step) => (
                            <BanOrPick key={step.step} step={step} color={team.color} size={size} />
                          ))}
                        </Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

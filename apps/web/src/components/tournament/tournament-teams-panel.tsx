/**
 * GC-Stats - tournament-teams-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { TeamBadge } from "@/components/home/team-badge";
import { QualificationSourceIcon } from "@/components/tournament/qualification-source-icon";
import { slugify } from "@/lib/entity-id";
import type { TournamentParticipant } from "@/lib/tournament-page-data";

/**
 * "Teams participating" grid, mirroring V1's tournament show page
 * (public/tournament/show.blade.php's `teams_participating` block): one
 * card per entrant, logo by default, roster on toggle — both per-card and
 * via a "show all rosters" master switch. Client component only for that
 * toggle state, everything else stays server-rendered data.
 */
export function TournamentTeamsPanel({
  participants,
  title,
  showAllLabel,
  hideAllLabel,
  showRosterLabel,
  hideRosterLabel,
  noRosterLabel,
  emptyLabel,
}: {
  participants: TournamentParticipant[];
  title: string;
  showAllLabel: string;
  hideAllLabel: string;
  showRosterLabel: string;
  hideRosterLabel: string;
  noRosterLabel: string;
  emptyLabel: string;
}) {
  const [showAllRosters, setShowAllRosters] = useState(false);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());

  const toggleCard = (entrantId: number) => {
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(entrantId)) next.delete(entrantId);
      else next.add(entrantId);
      return next;
    });
  };

  const isRosterShown = (entrantId: number) => (showAllRosters ? !flipped.has(entrantId) : flipped.has(entrantId));

  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2.5">
        <h2 className="text-[13px] font-extrabold tracking-[0.13em] text-neutral-50 uppercase">{title}</h2>
        <span className="flex-1" />
        {participants.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setShowAllRosters((v) => !v);
              setFlipped(new Set());
            }}
            className="font-mono text-[11px] text-[#e4ae22] transition-colors hover:underline"
          >
            {showAllRosters ? hideAllLabel : showAllLabel}
          </button>
        )}
      </div>

      {participants.length === 0 ? (
        <p className="text-sm text-neutral-500">{emptyLabel}</p>
      ) : (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
        {participants.map((p) => {
          const rosterShown = isRosterShown(p.entrantId);
          const hasRoster = p.roster.length > 0;
          const inner = p.teamId ? (
            <Link href={`/team/${p.teamId}/${slugify(p.displayName)}`} className="truncate text-[11px] font-bold tracking-tight text-neutral-100 transition-colors hover:text-[#e4ae22]">
              {p.displayName}
            </Link>
          ) : (
            <span className="truncate text-[11px] font-bold tracking-tight text-neutral-100">{p.displayName}</span>
          );

          return (
            <div
              key={p.entrantId}
              className="relative flex h-full flex-col items-center gap-2 rounded-xl border border-neutral-800 p-3 text-center transition-colors"
              style={{ background: "var(--gcs-surface-2)" }}
            >
              {p.qualificationSource && (
                <div className="absolute top-2 right-2">
                  <QualificationSourceIcon source={p.qualificationSource} />
                </div>
              )}
              {inner}

              <div className="flex w-full flex-1 items-center justify-center">
                {!rosterShown && <TeamBadge tag={p.shortName ?? "?"} logoUrl={p.logoUrl} logoUrlLight={p.logoUrlLight} size={56} />}

                {rosterShown && hasRoster && (
                  <div className="flex w-full flex-col items-center justify-center gap-1 rounded-lg py-2" style={{ background: "var(--gcs-surface-3)" }}>
                    {p.roster.map((player) => (
                      <span key={player.personId} className="w-full truncate text-[11px] font-semibold leading-tight text-neutral-200">
                        {player.handle}
                      </span>
                    ))}
                  </div>
                )}

                {rosterShown && !hasRoster && <span className="text-[10.5px] text-neutral-500">{noRosterLabel}</span>}
              </div>

              {hasRoster && (
                <button
                  type="button"
                  onClick={() => toggleCard(p.entrantId)}
                  className="mt-1 rounded-md border border-neutral-800 bg-white/5 px-2 py-1 text-[10px] font-bold tracking-[0.08em] text-neutral-400 uppercase transition-colors hover:border-[#5c4c22] hover:text-[#e4ae22]"
                >
                  {rosterShown ? hideRosterLabel : showRosterLabel}
                </button>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

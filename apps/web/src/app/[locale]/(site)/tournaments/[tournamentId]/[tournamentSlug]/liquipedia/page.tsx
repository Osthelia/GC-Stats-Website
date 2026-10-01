/**
 * GC-Stats - page
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { parseEntityId, slugify } from "@/lib/entity-id";
import { getPublicTournamentHeader } from "@/lib/tournament-bracket-data";
import { getLiquipediaStageOptions, getStageLiquipediaWikicodes } from "@/lib/liquipedia-match-data";
import { LiquipediaWikicodeBlock } from "@/components/match/liquipedia-wikicode-block";
import { FormattedDate } from "@/components/formatted-date";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "matchLiquipedia" });
  return { title: t("stageMetaTitle"), robots: { index: false } };
}

function MatchesSkeleton() {
  return (
    <div className="mt-6 space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-72 w-full animate-pulse rounded-2xl border border-neutral-800" style={{ background: "var(--gcs-surface-3)" }} />
      ))}
    </div>
  );
}

async function StageWikicodes({ stageId }: { stageId: number }) {
  const t = await getTranslations("matchLiquipedia");
  const items = await getStageLiquipediaWikicodes(stageId);
  if (items.length === 0) return <p className="mt-6 text-sm text-neutral-500">{t("stageEmpty")}</p>;

  const unlinked = [...new Set(items.flatMap((item) => item.unlinkedTeams))];

  return (
    <>
      <p className="mt-6 text-sm text-neutral-400">{t("stageMatchCount", { count: items.length })}</p>

      {unlinked.length > 0 && (
        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {t("unlinkedWarning", { teams: unlinked.join(", ") })}
        </p>
      )}

      <div className="mt-6 space-y-6">
        {items.map((item, index) => {
          const hasScore = item.status !== "pending" && item.scoreA !== null && item.scoreB !== null;
          return (
            <section key={item.matchId} id={`match-${item.matchId}`} className="scroll-mt-24">
              <LiquipediaWikicodeBlock
                wikicode={item.wikicode}
                header={
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] font-black tracking-[0.2em] text-neutral-500 uppercase">
                      #{index + 1} · {item.containerName} · {item.label ?? t("round", { round: item.round })}
                    </div>
                    <Link
                      href={`/match/${item.matchId}`}
                      className="mt-1 block truncate text-sm font-black text-neutral-100 transition-colors hover:text-[#e4ae22] active:opacity-60"
                    >
                      {item.teamAName}
                      <span className="mx-2 font-mono text-neutral-500">{hasScore ? `${item.scoreA} - ${item.scoreB}` : "vs"}</span>
                      {item.teamBName}
                    </Link>
                    <div className="mt-0.5 font-mono text-[10px] text-neutral-500">
                      {item.scheduledAt ? (
                        <>
                          <FormattedDate date={item.scheduledAt} mode="date" /> · <FormattedDate date={item.scheduledAt} mode="time" />
                        </>
                      ) : (
                        t("unknownDate")
                      )}
                    </div>
                  </div>
                }
              />
            </section>
          );
        })}
      </div>
    </>
  );
}

export default async function TournamentLiquipediaPage({
  params,
  searchParams,
}: {
  params: Promise<{ tournamentId: string; tournamentSlug: string }>;
  searchParams: Promise<{ stage?: string }>;
}) {
  const { tournamentId } = await params;
  const id = parseEntityId(tournamentId);
  if (id === null) notFound();

  const tournament = await getPublicTournamentHeader(id);
  if (!tournament) notFound();

  const [stageOptions, t, sp] = await Promise.all([getLiquipediaStageOptions(id), getTranslations("matchLiquipedia"), searchParams]);
  const requested = Number(sp.stage);
  const stage = stageOptions.find((s) => s.id === requested) ?? stageOptions[0];
  const basePath = `/tournaments/${tournament.id}/${slugify(tournament.name)}`;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
      <Link href={basePath} className="text-xs text-neutral-500 transition-colors hover:text-neutral-200 active:opacity-60">
        {t("backToTournament")}
      </Link>
      <h1 className="mt-2 text-2xl font-black text-neutral-100">{t("stageTitle")}</h1>
      <p className="mt-1 text-sm text-neutral-400">{tournament.name}</p>
      <p className="mt-1 text-xs text-neutral-500">{t("utcNote")}</p>

      {stageOptions.length === 0 || !stage ? (
        <p className="mt-6 text-sm text-neutral-500">{t("noStages")}</p>
      ) : (
        <>
          <nav aria-label={t("stageSelector")} className="mt-6 flex flex-wrap gap-2">
            {stageOptions.map((option) => {
              const active = option.id === stage.id;
              return (
                <Link
                  key={option.id}
                  href={`${basePath}/liquipedia?stage=${option.id}`}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-[9px] border px-3.5 py-1.5 text-xs font-bold transition-colors active:scale-95 ${
                    active ? "border-[#e4ae22] bg-[#e4ae22]/15 text-[#e4ae22]" : "border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-100"
                  }`}
                >
                  {option.name}
                </Link>
              );
            })}
          </nav>

          <Suspense key={stage.id} fallback={<MatchesSkeleton />}>
            <StageWikicodes stageId={stage.id} />
          </Suspense>
        </>
      )}
    </div>
  );
}

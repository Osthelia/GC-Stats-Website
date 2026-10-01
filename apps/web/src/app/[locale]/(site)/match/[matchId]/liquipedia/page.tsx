/**
 * GC-Stats - page
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { parseEntityId, slugify } from "@/lib/entity-id";
import { getLiquipediaMatchWikicode } from "@/lib/liquipedia-match-data";
import { LiquipediaWikicodeBlock } from "@/components/match/liquipedia-wikicode-block";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; matchId: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "matchLiquipedia" });
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function Page({ params }: { params: Promise<{ locale: string; matchId: string }> }) {
  const { matchId: matchIdParam } = await params;
  const matchId = parseEntityId(matchIdParam);
  if (matchId == null) notFound();

  const data = await getLiquipediaMatchWikicode(matchId);
  if (!data) notFound();

  const t = await getTranslations("matchLiquipedia");

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-6">
      <Link href={`/match/${matchId}`} className="text-xs text-neutral-500 transition-colors hover:text-neutral-200 active:opacity-60">
        {t("backToMatch")}
      </Link>
      <h1 className="mt-2 text-2xl font-black text-neutral-100">{t("title")}</h1>
      <p className="mt-1 text-sm text-neutral-400">
        {data.teamAName} vs {data.teamBName} · {data.tournamentName} · {data.stageName}
      </p>
      <p className="mt-1 text-xs text-neutral-500">{t("utcNote")}</p>
      {!data.tournamentIsGhost && (
        <Link
          href={`/tournaments/${data.tournamentId}/${slugify(data.tournamentName)}/liquipedia?stage=${data.stageId}`}
          className="mt-3 inline-block text-xs font-semibold text-[#e4ae22] transition-opacity hover:underline active:opacity-60"
        >
          {t("stageLink", { stage: data.stageName })}
        </Link>
      )}

      {data.unlinkedTeams.length > 0 && (
        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {t("unlinkedWarning", { teams: data.unlinkedTeams.join(", ") })}
        </p>
      )}

      <div className="mt-6">
        <LiquipediaWikicodeBlock wikicode={data.wikicode} />
      </div>
    </div>
  );
}

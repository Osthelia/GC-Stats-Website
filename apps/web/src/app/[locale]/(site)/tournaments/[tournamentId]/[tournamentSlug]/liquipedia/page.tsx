/**
 * GC-Stats - page
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { parseEntityId, slugify } from "@/lib/entity-id";
import { getPublicTournamentHeader, getPublicTournamentStages, type PublicStageContainer } from "@/lib/tournament-bracket-data";
import { LIQUIPEDIA_BRACKET_GENERATOR_URL, getBracketTemplates } from "@/lib/liquipedia-bracket-template";
import { LiquipediaBracketTemplate } from "@/components/tournament/liquipedia-bracket-template";
import { groupBracketContainers } from "@/lib/bracket-group-containers";
import { LiquipediaExportViewer } from "@/components/tournament/liquipedia-export-viewer";
import { LiquipediaGroupMatches } from "@/components/tournament/liquipedia-group-matches";
import { TournamentBracketCanvasLazy } from "@/components/tournament/tournament-bracket-canvas-lazy";
import { TournamentContainerTabs, type TournamentContainerTab } from "@/components/tournament/tournament-container-tabs";
import { GOLD } from "@/lib/theme-colors";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "matchLiquipedia" });
  return { title: t("stageMetaTitle"), robots: { index: false } };
}

function BracketSkeleton() {
  return <div className="h-96 w-full animate-pulse rounded-xl border border-neutral-800" style={{ background: "var(--gcs-surface-3)" }} />;
}

/** Canvas of one physical bracket, followed by its Liquipedia template when one is linked. */
function BracketWithTemplate({ containers, templates, tbdLabel }: { containers: PublicStageContainer[]; templates: Map<number, string>; tbdLabel: string }) {
  const template = containers.map((c) => templates.get(c.id)).find((value) => value !== undefined);
  return (
    <div className="flex flex-col gap-4">
      <TournamentBracketCanvasLazy containers={containers} tbdLabel={tbdLabel} />
      {template && <LiquipediaBracketTemplate template={template} generatorUrl={LIQUIPEDIA_BRACKET_GENERATOR_URL} />}
    </div>
  );
}

/** The stage pills and its bracket, where a click on a match opens its wikicode. */
async function ExportBracket({ tournamentId, basePath, activeStageId }: { tournamentId: number; basePath: string; activeStageId: number | null }) {
  const [t, tBracket, { stages, activeStage }] = await Promise.all([
    getTranslations("matchLiquipedia"),
    getTranslations("tournamentPage"),
    getPublicTournamentStages(tournamentId, activeStageId),
  ]);
  if (!activeStage) return <p className="rounded-xl border border-dashed border-neutral-800 px-4 py-10 text-center text-sm text-neutral-500">{t("noStages")}</p>;

  const graphContainers = activeStage.containers.filter((c) => c.graph && c.graph.matches.length > 0);
  const bracketGroups = groupBracketContainers(graphContainers);
  const templates = await getBracketTemplates(graphContainers.map((c) => c.id));
  const listContainers = activeStage.containers.filter((c) => !(c.graph && c.graph.matches.length > 0));
  const listTabs: TournamentContainerTab[] = listContainers.map((c) => ({ id: c.id, name: c.name, content: <LiquipediaGroupMatches matches={c.matches ?? []} /> }));

  return (
    <div className="flex flex-col gap-6">
      {stages.length > 1 && (
        <nav aria-label={t("stageSelector")} className="flex flex-wrap gap-1.5">
          {stages.map((stage) => {
            const on = stage.id === activeStage.id;
            return (
              <Link
                key={stage.id}
                href={{ pathname: `${basePath}/liquipedia`, query: { stage: stage.id } }}
                aria-current={on ? "page" : undefined}
                className={`rounded-lg px-3 py-1.5 text-[13px] transition-all duration-200 active:scale-[0.96] ${on ? "" : "hover:-translate-y-0.5 hover:bg-white/[0.06]"}`}
                style={on ? { background: GOLD, color: "#0b0b0c", fontWeight: 700 } : { background: "var(--gcs-surface-3)", color: "var(--gcs-text-secondary)", fontWeight: 600, border: "1px solid #262626" }}
              >
                {stage.name}
              </Link>
            );
          })}
        </nav>
      )}

      {activeStage.containers.length === 0 && <p className="rounded-xl border border-dashed border-neutral-800 px-4 py-10 text-center text-sm text-neutral-500">{tBracket("noContainers")}</p>}

      {graphContainers.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-neutral-800 p-4" style={{ background: "var(--gcs-surface-2)" }}>
          {bracketGroups.length > 1 ? (
            <TournamentContainerTabs
              tabs={bracketGroups.map((g) => ({
                id: g.containers[0]!.id,
                name: g.label,
                content: <BracketWithTemplate key={`${activeStage.id}-${g.key}`} containers={g.containers} templates={templates} tbdLabel={tBracket("tbd")} />,
              }))}
            />
          ) : (
            <BracketWithTemplate key={activeStage.id} containers={graphContainers} templates={templates} tbdLabel={tBracket("tbd")} />
          )}
        </div>
      )}

      {listTabs.length > 0 && <TournamentContainerTabs tabs={listTabs} />}
    </div>
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

  const [t, sp] = await Promise.all([getTranslations("matchLiquipedia"), searchParams]);
  const requested = Number(sp.stage);
  const basePath = `/tournaments/${tournament.id}/${slugify(tournament.name)}`;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
      <Link href={basePath} className="text-xs text-neutral-500 transition-colors hover:text-neutral-200 active:opacity-60">
        {t("backToTournament")}
      </Link>
      <h1 className="mt-2 text-2xl font-black text-neutral-100">{t("tournamentTitle")}</h1>
      <p className="mt-1 text-sm text-neutral-400">{tournament.name}</p>

      <LiquipediaExportViewer tournamentId={tournament.id}>
        <Suspense key={requested || "default"} fallback={<BracketSkeleton />}>
          <ExportBracket tournamentId={tournament.id} basePath={basePath} activeStageId={Number.isInteger(requested) && requested > 0 ? requested : null} />
        </Suspense>
      </LiquipediaExportViewer>
    </div>
  );
}

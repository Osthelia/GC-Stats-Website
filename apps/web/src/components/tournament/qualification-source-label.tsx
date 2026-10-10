/**
 * GC-Stats - qualification-source-label
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { slugify } from "@/lib/entity-id";
import type { EntrantQualificationSource } from "@/lib/entrant-qualification-source";

/** "Qualified via {tournament}" (linked), or the invite / points wording. Shared by the public teams panel and the admin entrants table. */
export function QualificationSourceLabel({ source, linkClassName, plain = false }: { source: EntrantQualificationSource; linkClassName?: string; plain?: boolean }) {
  const t = useTranslations("qualificationSource");

  if (source.type === "invite") return <>{t("invite")}</>;
  if (source.type === "points") return <>{source.pointTypeLabel ? t("points", { label: source.pointTypeLabel }) : t("pointsUnknown")}</>;
  if (!source.tournamentId || !source.tournamentName) return <>{t("tournament")}</>;

  const href = `/tournaments/${source.tournamentId}/${slugify(source.tournamentName)}`;
  const linkTag = (chunks: React.ReactNode) =>
    plain ? (
      chunks
    ) : (
      <Link href={href} className={linkClassName ?? "transition-colors hover:text-[#e4ae22] hover:underline"}>
        {chunks}
      </Link>
    );
  return (
    <>
      {t.rich("viaTournament", { name: source.tournamentName, tournament: linkTag })}
      {source.detail ? ` (${source.detail})` : ""}
    </>
  );
}

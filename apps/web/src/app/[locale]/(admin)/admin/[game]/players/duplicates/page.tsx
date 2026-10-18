/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PERMISSIONS } from "@gc-stats/db";
import { GAME_INFO } from "@gc-stats/db/game";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CountryFlag } from "@/components/admin/country-flag";
import { listPlayerDuplicates, type DuplicateSide } from "@/lib/admin-player-duplicates";
import { requireAdminPermission } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";
import { gameFromParams } from "@/lib/game";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.players.duplicates" });
  return { title: t("title") };
}

function PersonCell({ person }: { person: DuplicateSide }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-2 font-medium">
        <CountryFlag code={person.countryCode} secondaryCode={person.secondaryCountryCode} className="size-3.5 shrink-0" />
        <Link href={`/admin/players/${person.id}`} className="hover:underline">
          {person.handle}
        </Link>
        <span className="text-xs text-muted-foreground">#{person.id}</span>
      </span>
      <span className="flex gap-1.5">
        {person.games.map((game) => (
          <span key={game} className="rounded-full border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {GAME_INFO[game].shortName}
          </span>
        ))}
      </span>
    </div>
  );
}

export default async function AdminPlayerDuplicatesPage({ params }: { params: Promise<{ locale: string; game: string }> }) {
  const game = await gameFromParams(params);
  const { locale } = await params;
  await requireAdminPermission(locale as AppLocale, PERMISSIONS.playersMerge, game);
  const t = await getTranslations({ locale, namespace: "admin.players.duplicates" });

  const pairs = await listPlayerDuplicates(game);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/players" className="text-sm text-muted-foreground hover:text-foreground">
          {t("backToList")}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description", { game: GAME_INFO[game].name })}</p>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columnSource", { game: GAME_INFO[game].shortName })}</TableHead>
              <TableHead>{t("columnTarget")}</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pairs.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {pairs.map(({ source, target }) => (
              <TableRow key={`${source.id}-${target.id}`}>
                <TableCell>
                  <PersonCell person={source} />
                </TableCell>
                <TableCell>
                  <PersonCell person={target} />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" render={<Link href={`/admin/players/${source.id}/merge?target=${target.id}`} />}>
                    {t("merge")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

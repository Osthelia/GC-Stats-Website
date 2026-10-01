/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth } from "@/auth";
import { parseEntityId, slugify } from "@/lib/entity-id";
import { getPublicTournamentHeader } from "@/lib/tournament-bracket-data";
import { getMyGroupsForTournament } from "@/lib/pickem/pickem-data";
import { TournamentHeader } from "@/components/tournament/tournament-header";
import { GroupsActions } from "@/components/pickem/groups-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function TournamentPickemGroupsPage({ params }: { params: Promise<{ tournamentId: string; tournamentSlug: string }> }) {
  const { tournamentId } = await params;
  const id = parseEntityId(tournamentId);
  if (id === null) notFound();

  const tournament = await getPublicTournamentHeader(id);
  if (!tournament) notFound();

  const basePath = `${tournament.id}/${slugify(tournament.name)}`;
  const t = await getTranslations("pickemPage.groups");

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const groups = userId ? await getMyGroupsForTournament(userId, id) : [];

  return (
    <div>
      <TournamentHeader tournament={tournament} basePath={basePath} activeTab="pickem" />

      <div className="mx-auto flex max-w-[1000px] flex-col gap-6 px-6 py-7 pb-[70px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold">{t("heading")}</h1>
          {userId && <GroupsActions tournamentId={id} />}
        </div>

        {!userId && <p className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">{t("loginRequired")}</p>}

        {userId && groups.length === 0 && <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">{t("empty")}</p>}

        {userId && groups.length > 0 && (
          <div className="flex flex-col gap-3">
            {groups.map((group) => (
              <Card key={group.id}>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Link href={`/tournaments/${basePath}/pickem/groups/${group.id}`} className="hover:underline">
                      {group.name}
                    </Link>
                    {group.isOwner && <Badge variant="outline">{t("ownerBadge")}</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{t("memberCount", { count: group.memberCount })}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

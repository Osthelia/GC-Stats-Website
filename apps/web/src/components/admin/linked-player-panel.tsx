/**
 * GC-Stats - linked-player-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import type { AdminUserLinkedPlayer } from "@/lib/admin-user-detail";

/** Mirrors V1's admin user detail "player" card — resources/views/admin/users/show.blade.php. */
export async function LinkedPlayerPanel({ player }: { player: AdminUserLinkedPlayer | null }) {
  const t = await getTranslations("admin.users.linkedPlayer");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {!player ? (
          <p className="text-sm text-muted-foreground">{t("none")}</p>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{player.handle}</span>
              <Link href={`/admin/players/${player.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                {t("view")}
              </Link>
            </div>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("currentTeams")}</p>
            {player.currentTeams.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("noCurrentTeam")}</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {player.currentTeams.map((team) => (
                  <Link
                    key={team.id}
                    href={`/admin/teams/${team.id}`}
                    className="rounded-md border bg-muted px-2 py-1 text-xs font-medium transition-colors hover:bg-muted/70"
                  >
                    {team.name}
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

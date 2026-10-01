/**
 * GC-Stats - tournaments-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter, Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminSortableTh } from "@/components/admin/admin-sortable-th";
import { TournamentDialog } from "@/components/admin/tournament-dialog";
import { GhostMatchDialog } from "@/components/admin/ghost-match-dialog";
import { GhostBadge } from "@/components/admin/ghost-badge";
import { deleteTournament } from "@/actions/admin-tournaments";
import { tournamentStatusBadgeClass } from "@/lib/status-colors";
import { DEFAULT_TOURNAMENT_LOGO } from "@/lib/home-fake-data";
import { cn } from "@/lib/utils";
import type { AdminTournamentRow, SortDirection } from "@/lib/admin-tournaments";

/** Every logo needs a fallback (CLAUDE.md) — the site's default tournament icon, same as V1's `$tournament->logo` and the public site, rather than a generic broken-image glyph. */
function TournamentLogo({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src && !failed ? src : DEFAULT_TOURNAMENT_LOGO} alt={name} className="size-8 shrink-0 rounded-md border object-contain" onError={() => setFailed(true)} />
  );
}

export function TournamentsPanel({
  tournaments,
  canManage,
  pointTypeOptions,
  sortable,
}: {
  tournaments: AdminTournamentRow[];
  canManage: boolean;
  pointTypeOptions: { id: number; name: string; label: string }[];
  sortable: { pathname: string; sort: string; direction: SortDirection; query: Record<string, string> };
}) {
  const t = useTranslations("admin.tournaments");
  const locale = useLocale();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [isPending, startTransition] = useTransition();

  const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }), [locale]);
  const formatDate = (value: string) => dateFormat.format(new Date(`${value.slice(0, 10)}T00:00:00`));

  function handleDelete(tournament: AdminTournamentRow) {
    if (!window.confirm(t("deleteConfirm", { name: tournament.name }))) return;
    startTransition(async () => {
      const result = await deleteTournament(tournament.id);
      if (!result.ok) {
        toast.error(t(`error.${result.error}`));
        return;
      }
      router.refresh();
      toast.success(t("deleteSuccess"));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("heading")}</h2>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <GhostMatchDialog />
            <Button onClick={() => setCreating(true)}>{t("createButton")}</Button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12" />
              <AdminSortableTh pathname={sortable.pathname} col="name" label={t("columnName")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
              <TableHead>{t("columnRegion")}</TableHead>
              <AdminSortableTh pathname={sortable.pathname} col="startDate" label={t("columnDates")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
              <AdminSortableTh pathname={sortable.pathname} col="status" label={t("columnStatus")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tournaments.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {tournaments.map((tournament) => (
              <TableRow key={tournament.id} className={cn("border-l-2", tournament.active ? "border-l-emerald-500/60" : "border-l-destructive/60")}>
                <TableCell>
                  <TournamentLogo src={tournament.logoUrl} name={tournament.name} />
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/tournaments/${tournament.id}`} className="hover:underline">
                      {tournament.name}
                    </Link>
                    {tournament.isGhost && <GhostBadge />}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{tournament.region ?? "-"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(tournament.startDate)} → {formatDate(tournament.endDate)}
                </TableCell>
                <TableCell>
                  <Badge className={tournamentStatusBadgeClass(tournament.status)}>{t(`status.${tournament.status}`)}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" render={<Link href={`/admin/tournaments/${tournament.id}`} />}>
                      {t("viewButton")}
                    </Button>
                    {canManage && (
                      <Button variant="outline" size="sm" disabled={isPending} onClick={() => handleDelete(tournament)} className="text-destructive hover:text-destructive">
                        {t("deleteButton")}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TournamentDialog tournament={null} pointTypeOptions={pointTypeOptions} open={creating} onOpenChange={setCreating} />
    </div>
  );
}

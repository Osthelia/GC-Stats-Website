/**
 * GC-Stats - tournament-detail-header
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { CalendarDaysIcon, MapPinIcon, CoinsIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TournamentDialog } from "@/components/admin/tournament-dialog";
import { AdminPublicLinkButton } from "@/components/admin/admin-public-link-button";
import { GhostBadge } from "@/components/admin/ghost-badge";
import { toggleTournamentActive, deleteTournament } from "@/actions/admin-tournaments";
import { slugify } from "@/lib/entity-id";
import { tournamentStatusBadgeClass, tournamentActiveBadgeClass } from "@/lib/status-colors";
import { DEFAULT_TOURNAMENT_LOGO } from "@/lib/home-fake-data";
import { cn } from "@/lib/utils";
import type { AdminTournamentDetailRow } from "@/lib/admin-tournaments";

/** Every logo needs a fallback (CLAUDE.md) — the site's default tournament icon, same as V1's `$tournament->logo` (always resolves to something, never a broken/missing image). */
function TournamentLogoTile({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex size-24 shrink-0 items-center justify-center self-center overflow-hidden rounded-xl border bg-muted/40 md:size-28 md:self-start">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src && !failed ? src : DEFAULT_TOURNAMENT_LOGO} alt={name} className="size-full object-contain p-2" onError={() => setFailed(true)} />
    </div>
  );
}

export function TournamentDetailHeader({
  tournament,
  pointTypeOptions,
  canManage,
}: {
  tournament: AdminTournamentDetailRow;
  pointTypeOptions: { id: number; name: string; label: string }[];
  canManage: boolean;
}) {
  const t = useTranslations("admin.tournaments");
  const locale = useLocale();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }), [locale]);
  const formatDate = (value: string) => dateFormat.format(new Date(`${value.slice(0, 10)}T00:00:00`));

  function handleToggleActive() {
    if (!window.confirm(tournament.active ? t("deactivateConfirm") : t("activateConfirm"))) return;
    startTransition(async () => {
      const result = await toggleTournamentActive(tournament.id);
      if (!result.ok) return;
      router.refresh();
      toast.success(result.active ? t("activateSuccess") : t("deactivateSuccess"));
    });
  }

  function handleDelete() {
    if (!window.confirm(t("deleteConfirm", { name: tournament.name }))) return;
    startTransition(async () => {
      const result = await deleteTournament(tournament.id);
      if (!result.ok) {
        toast.error(t(`error.${result.error}`));
        return;
      }
      toast.success(t("deleteSuccess"));
      router.push("/admin/tournaments");
    });
  }

  const publicHref = `/tournaments/${tournament.id}/${slugify(tournament.name)}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <Link href="/admin/tournaments" className="text-sm text-muted-foreground hover:text-foreground">
          {t("backToList")}
        </Link>
        {!tournament.isGhost && <AdminPublicLinkButton href={publicHref} label={t("publicPageButton")} />}
      </div>

      {/* Big header, reprising V1's admin/tournaments/show.blade.php: logo tile + info left, action buttons stacked right. */}
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm md:flex-row">
        <TournamentLogoTile src={tournament.logoUrl} name={tournament.name} />

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            {tournament.category && <Badge variant="secondary">{tournament.category}</Badge>}
            {tournament.region && <Badge variant="outline">{tournament.region}</Badge>}
            <Badge className={tournamentStatusBadgeClass(tournament.status)}>{t(`status.${tournament.status}`)}</Badge>
            {tournament.isGhost && <GhostBadge />}
            {canManage ? (
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-6 px-2 text-xs hover:opacity-80", tournamentActiveBadgeClass(tournament.active))}
                disabled={isPending}
                onClick={handleToggleActive}
              >
                {t(tournament.active ? "activateButton" : "deactivateButton")}
              </Button>
            ) : (
              <Badge className={tournamentActiveBadgeClass(tournament.active)}>{t(tournament.active ? "activateButton" : "deactivateButton")}</Badge>
            )}
          </div>

          <h1 className="text-2xl font-semibold">{tournament.name}</h1>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDaysIcon className="size-3.5" />
              {formatDate(tournament.startDate)} → {formatDate(tournament.endDate)}
            </span>
            {tournament.location && (
              <span className="flex items-center gap-1.5">
                <MapPinIcon className="size-3.5" />
                {tournament.location}
              </span>
            )}
            {tournament.prizePool && (
              <span className="flex items-center gap-1.5 text-amber-400">
                <CoinsIcon className="size-3.5" />
                {tournament.prizePool}
              </span>
            )}
          </div>

          {tournament.description && <p className="mt-3 whitespace-pre-line rounded-md border-l-2 border-l-amber-400 bg-muted/30 p-3 text-sm text-muted-foreground">{tournament.description}</p>}
        </div>

        <div className="flex w-full flex-row flex-wrap gap-2 md:w-48 md:shrink-0 md:flex-col">
          {canManage && <Button onClick={() => setEditing(true)}>{t("editButton")}</Button>}
          <Button variant="outline" render={<Link href={`/admin/tournaments/${tournament.id}/bracket`} />}>
            {t("bracketViewButton")}
          </Button>
          <Button variant="outline" render={<Link href={`/admin/tournaments/${tournament.id}/bracket-editor`} />}>
            {t("bracketManagementButton")}
          </Button>
          <Button variant="outline" render={<Link href={`/admin/tournaments/${tournament.id}/operations`} />}>
            {t("operationsButton")}
          </Button>
          <Button variant="outline" render={<Link href={`/admin/tournaments/${tournament.id}/liquipedia`} />}>
            {t("liquipediaButton")}
          </Button>
          {canManage && (
            <Button variant="outline" disabled={isPending} onClick={handleDelete} className="text-destructive hover:text-destructive">
              {t("deleteButton")}
            </Button>
          )}
        </div>
      </div>

      <TournamentDialog tournament={tournament} pointTypeOptions={pointTypeOptions} open={editing} onOpenChange={setEditing} />
    </div>
  );
}

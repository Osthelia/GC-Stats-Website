/**
 * GC-Stats - team-merge-form
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TeamPicker } from "@/components/admin/team-picker";
import { MergeCategorySection, type MergeCategoryItem } from "@/components/admin/merge-category-section";
import { useRouter } from "@/i18n/navigation";
import { mergeTeams, searchTeamMergeTargets } from "@/actions/admin-team-merge";
import type { MergeTournamentEntry, MergeNewsEntry } from "@/lib/admin-team-merge";
import type { AdminTeamRosterMember } from "@/lib/admin-teams";
import type { AdminLogoEntry } from "@/lib/admin-logos";

export function TeamMergeForm({
  teamId,
  teamName,
  rosterItems,
  tournamentItems,
  newsItems,
  logoItems,
}: {
  teamId: number;
  teamName: string;
  rosterItems: AdminTeamRosterMember[];
  tournamentItems: MergeTournamentEntry[];
  newsItems: MergeNewsEntry[];
  logoItems: AdminLogoEntry[];
}) {
  const t = useTranslations("admin.teams.merge");
  const tRole = useTranslations("admin.teams.edit");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [target, setTarget] = useState<{ id: number; name: string } | null>(null);
  const [roster, setRoster] = useState<Set<string>>(new Set());
  const [tournamentsSel, setTournamentsSel] = useState<Set<string>>(new Set());
  const [news, setNews] = useState<Set<string>>(new Set());
  const [logosSel, setLogosSel] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const rosterOptions: MergeCategoryItem[] = useMemo(
    () =>
      rosterItems.map((m) => ({
        id: String(m.membershipId),
        label: (
          <>
            {m.handle}
            {m.role !== "player" && <span className="text-muted-foreground"> ({tRole(`role.${m.role}`)})</span>}
            <span className="text-muted-foreground"> {m.isCurrent ? t("rosterOngoing", { since: m.since ?? "" }) : t("rosterPeriod", { since: m.since ?? "", until: m.until ?? "" })}</span>
          </>
        ),
      })),
    [rosterItems, t, tRole]
  );

  const tournamentOptions: MergeCategoryItem[] = useMemo(
    () => tournamentItems.map((e) => ({ id: String(e.entrantId), label: e.tournamentName })),
    [tournamentItems]
  );

  const newsOptions: MergeCategoryItem[] = useMemo(() => newsItems.map((n) => ({ id: String(n.newsId), label: n.title })), [newsItems]);

  const logoOptions: MergeCategoryItem[] = useMemo(
    () => logoItems.map((l) => ({ id: l.id, label: l.isOngoing ? t("logoOngoing", { since: l.since ?? "" }) : t("logoPeriod", { since: l.since ?? "", until: l.until ?? "" }) })),
    [logoItems, t]
  );

  function makeToggle(set: Set<string>, setter: (next: Set<string>) => void) {
    return (id: string) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setter(next);
    };
  }

  function makeToggleAll(items: MergeCategoryItem[], setter: (next: Set<string>) => void) {
    return (checked: boolean) => setter(checked ? new Set(items.map((i) => i.id)) : new Set());
  }

  const totalSelected = roster.size + tournamentsSel.size + news.size + logosSel.size;

  function handleSubmit() {
    if (!target) return;
    setConfirmOpen(true);
  }

  function runMerge() {
    if (!target) return;
    setConfirmOpen(false);

    startTransition(async () => {
      const result = await mergeTeams(teamId, target.id, {
        roster: [...roster].map(Number),
        tournaments: [...tournamentsSel].map(Number),
        news: [...news].map(Number),
        logos: [...logosSel],
      });
      if (!result.ok) {
        toast.error(t(`error.${result.error}`));
        return;
      }
      toast.success(t("success"));
      router.push(`/admin/teams/${target.id}`);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description", { name: teamName })}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("selectTarget")}</span>
          <div className="max-w-sm">
            <TeamPicker
              value={target}
              onChange={setTarget}
              placeholder={t("targetPlaceholder")}
              searchPlaceholder={t("targetSearchPlaceholder")}
              noResultsLabel={t("targetSearchEmpty")}
              search={(query) => searchTeamMergeTargets(teamId, query)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <MergeCategorySection title={t("categories.roster")} items={rosterOptions} selected={roster} onToggle={makeToggle(roster, setRoster)} onToggleAll={makeToggleAll(rosterOptions, setRoster)} />
          <MergeCategorySection
            title={t("categories.tournaments")}
            hint={t("tournamentsHint")}
            items={tournamentOptions}
            selected={tournamentsSel}
            onToggle={makeToggle(tournamentsSel, setTournamentsSel)}
            onToggleAll={makeToggleAll(tournamentOptions, setTournamentsSel)}
          />
          <MergeCategorySection title={t("categories.news")} items={newsOptions} selected={news} onToggle={makeToggle(news, setNews)} onToggleAll={makeToggleAll(newsOptions, setNews)} />
          <MergeCategorySection title={t("categories.logos")} items={logoOptions} selected={logosSel} onToggle={makeToggle(logosSel, setLogosSel)} onToggleAll={makeToggleAll(logoOptions, setLogosSel)} />
        </div>

        {rosterOptions.length + tournamentOptions.length + newsOptions.length + logoOptions.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("nothingToMove")}</p>
        )}

        <div className="flex items-center gap-3 border-t pt-4">
          <Button onClick={handleSubmit} disabled={!target || isPending || totalSelected === 0}>
            {isPending ? (
              <>
                <Loader2Icon className="size-3.5 animate-spin" />
                {t("submitting")}
              </>
            ) : (
              t("submit")
            )}
          </Button>
          <span className="text-xs text-muted-foreground">{target ? t("itemsSelected", { count: totalSelected, target: target.name }) : t("noTargetSelected")}</span>
        </div>
      </CardContent>

      {target && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={t("confirmTitle")}
          description={t("confirm", { source: teamName, target: target.name })}
          confirmLabel={t("submit")}
          cancelLabel={t("cancel")}
          onConfirm={runMerge}
          isPending={isPending}
        />
      )}
    </Card>
  );
}

/**
 * GC-Stats - player-merge-form
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
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PersonPicker } from "@/components/admin/person-picker";
import { MergeCategorySection, type MergeCategoryItem } from "@/components/admin/merge-category-section";
import { useRouter } from "@/i18n/navigation";
import { mergePlayers, searchPlayerMergeTargets } from "@/actions/admin-player-merge";
import type { MergeMapStatEntry, MergeNewsEntry } from "@/lib/admin-player-merge";
import type { AdminPlayerTeamHistoryEntry } from "@/lib/admin-players";
import type { PersonOrganization } from "@/lib/person-organizations-data";
import type { AdminLogoEntry } from "@/lib/admin-logos";
import type { ProductionEntry } from "@/lib/production-credits-data";

export function PlayerMergeForm({
  playerId,
  playerHandle,
  playerPronouns,
  hasLinkedAccount,
  teamHistoryItems,
  organizationItems,
  productionItems,
  newsItems,
  logoItems,
  matchStatItems,
}: {
  playerId: number;
  playerHandle: string;
  playerPronouns: number | null;
  hasLinkedAccount: boolean;
  teamHistoryItems: AdminPlayerTeamHistoryEntry[];
  organizationItems: PersonOrganization[];
  productionItems: ProductionEntry[];
  newsItems: MergeNewsEntry[];
  logoItems: AdminLogoEntry[];
  matchStatItems: MergeMapStatEntry[];
}) {
  const t = useTranslations("admin.players.merge");
  const tRole = useTranslations("admin.players.edit");
  const tOrgRole = useTranslations("organizationPage.roleOptions");
  const tProduction = useTranslations("production");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [target, setTarget] = useState<{ id: number; handle: string } | null>(null);
  const [teamHistory, setTeamHistory] = useState<Set<string>>(new Set());
  const [organizations, setOrganizations] = useState<Set<string>>(new Set());
  const [production, setProduction] = useState<Set<string>>(new Set());
  const [news, setNews] = useState<Set<string>>(new Set());
  const [logosSel, setLogosSel] = useState<Set<string>>(new Set());
  const [matchStats, setMatchStats] = useState<Set<string>>(new Set());
  const [linkedAccount, setLinkedAccount] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const teamHistoryOptions: MergeCategoryItem[] = useMemo(
    () =>
      teamHistoryItems.map((entry) => ({
        id: String(entry.membershipId),
        label: (
          <>
            {entry.teamName}
            {entry.role !== "player" && <span className="text-muted-foreground"> ({tRole(`role.${entry.role}`)})</span>}
            <span className="text-muted-foreground"> {entry.isCurrent ? t("periodOngoing", { since: entry.since ?? "" }) : t("periodRange", { since: entry.since ?? "", until: entry.until ?? "" })}</span>
          </>
        ),
      })),
    [teamHistoryItems, t, tRole]
  );

  const organizationOptions: MergeCategoryItem[] = useMemo(
    () =>
      organizationItems.map((entry) => ({
        id: String(entry.membershipId),
        label: (
          <>
            {entry.name} <span className="text-muted-foreground">({tOrgRole.has(entry.role) ? tOrgRole(entry.role, { pronouns: playerPronouns ?? 2 }) : entry.role})</span>
            <span className="text-muted-foreground"> {entry.until ? t("periodRange", { since: entry.since ?? "", until: entry.until }) : t("periodOngoing", { since: entry.since ?? "" })}</span>
          </>
        ),
      })),
    [organizationItems, playerPronouns, t, tOrgRole]
  );

  const productionOptions: MergeCategoryItem[] = useMemo(
    () =>
      productionItems.map((entry) => ({
        id: String(entry.id),
        label: (
          <>
            {tProduction(`role.${entry.role}`)}
            {entry.titleOverride && <span className="text-muted-foreground"> ({entry.titleOverride})</span>}
            <span className="text-muted-foreground"> {entry.target.scope === "tournament" ? entry.target.tournamentName : tProduction("targetMatch", { label: entry.target.label, tournament: entry.target.tournamentName ?? "" })}</span>
          </>
        ),
      })),
    [productionItems, tProduction]
  );

  const newsOptions: MergeCategoryItem[] = useMemo(() => newsItems.map((n) => ({ id: String(n.newsId), label: n.title })), [newsItems]);

  const logoOptions: MergeCategoryItem[] = useMemo(
    () => logoItems.map((l) => ({ id: l.id, label: l.isOngoing ? t("periodOngoing", { since: l.since ?? "" }) : t("periodRange", { since: l.since ?? "", until: l.until ?? "" }) })),
    [logoItems, t]
  );

  const matchStatOptions: MergeCategoryItem[] = useMemo(
    () =>
      matchStatItems.map((entry) => ({
        id: String(entry.statId),
        label: (
          <>
            {entry.tournamentName}
            <span className="text-muted-foreground"> {entry.mapName ?? "?"} ({entry.agentName ?? "?"})</span>
          </>
        ),
      })),
    [matchStatItems]
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

  const totalSelected = teamHistory.size + organizations.size + production.size + news.size + logosSel.size + matchStats.size + (linkedAccount ? 1 : 0);

  function handleSubmit() {
    if (!target) return;
    setConfirmOpen(true);
  }

  function runMerge() {
    if (!target) return;
    setConfirmOpen(false);

    startTransition(async () => {
      const result = await mergePlayers(playerId, target.id, {
        teamHistory: [...teamHistory].map(Number),
        organizations: [...organizations].map(Number),
        productionCredits: [...production].map(Number),
        news: [...news].map(Number),
        logos: [...logosSel],
        matchStats: [...matchStats].map(Number),
        linkedAccount,
      });
      if (!result.ok) {
        toast.error(t(`error.${result.error}`));
        return;
      }
      toast.success(t("success"));
      router.push(`/admin/players/${target.id}`);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description", { name: playerHandle })}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("selectTarget")}</span>
          <div className="max-w-sm">
            <PersonPicker
              value={target}
              onChange={setTarget}
              placeholder={t("targetPlaceholder")}
              searchPlaceholder={t("targetSearchPlaceholder")}
              noResultsLabel={t("targetSearchEmpty")}
              search={(query) => searchPlayerMergeTargets(playerId, query)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <MergeCategorySection
            title={t("categories.teamHistory")}
            items={teamHistoryOptions}
            selected={teamHistory}
            onToggle={makeToggle(teamHistory, setTeamHistory)}
            onToggleAll={makeToggleAll(teamHistoryOptions, setTeamHistory)}
          />
          <MergeCategorySection
            title={t("categories.organizations")}
            items={organizationOptions}
            selected={organizations}
            onToggle={makeToggle(organizations, setOrganizations)}
            onToggleAll={makeToggleAll(organizationOptions, setOrganizations)}
          />
          <MergeCategorySection
            title={t("categories.production")}
            items={productionOptions}
            selected={production}
            onToggle={makeToggle(production, setProduction)}
            onToggleAll={makeToggleAll(productionOptions, setProduction)}
          />
          <MergeCategorySection
            title={t("categories.matchStats")}
            hint={t("matchStatsHint")}
            items={matchStatOptions}
            selected={matchStats}
            onToggle={makeToggle(matchStats, setMatchStats)}
            onToggleAll={makeToggleAll(matchStatOptions, setMatchStats)}
          />
          <MergeCategorySection title={t("categories.news")} items={newsOptions} selected={news} onToggle={makeToggle(news, setNews)} onToggleAll={makeToggleAll(newsOptions, setNews)} />
          <MergeCategorySection title={t("categories.logos")} items={logoOptions} selected={logosSel} onToggle={makeToggle(logosSel, setLogosSel)} onToggleAll={makeToggleAll(logoOptions, setLogosSel)} />

          {hasLinkedAccount && (
            <div className="border-t pt-4">
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox checked={linkedAccount} onCheckedChange={(checked) => setLinkedAccount(checked === true)} />
                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("categories.linkedAccount")}</span>
              </label>
              <p className="mt-1 text-xs text-muted-foreground">{t("linkedAccountHint")}</p>
            </div>
          )}
        </div>

        {teamHistoryOptions.length + organizationOptions.length + productionOptions.length + newsOptions.length + logoOptions.length + matchStatOptions.length === 0 && !hasLinkedAccount && (
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
          <span className="text-xs text-muted-foreground">{target ? t("itemsSelected", { count: totalSelected, target: target.handle }) : t("noTargetSelected")}</span>
        </div>
      </CardContent>

      {target && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={t("confirmTitle")}
          description={t("confirm", { source: playerHandle, target: target.handle })}
          confirmLabel={t("submit")}
          cancelLabel={t("cancel")}
          onConfirm={runMerge}
          isPending={isPending}
        />
      )}
    </Card>
  );
}

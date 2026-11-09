/**
 * GC-Stats - player-riot-accounts-card
 *
 * The Riot accounts of a League player: Riot ID, live or tournament realm, platform, where the link came from and
 * when the account last played. An admin adds one by Riot ID and region (the relay resolves it) or removes one;
 * the imported stats stay with the player either way. Shown on the League player page only.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { RIOT_CLUSTERS, type RiotCluster } from "@gc-stats/lol-stats-engine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormattedDate } from "@/components/formatted-date";
import { useRouter } from "@/i18n/navigation";
import { addPlayerRiotAccount, removePlayerRiotAccount, type AddRiotAccountResult } from "@/actions/admin-players";
import { RIOT_CLUSTER_NAMES } from "@/lib/tournament-regions";
import { useRiotErrorText } from "@/components/admin/use-riot-error-text";
import { isRiotErrorKind } from "@/lib/riot-errors";
import { useGame } from "@/lib/use-game";
import type { PersonAccount } from "@/lib/lol-accounts";

export function PlayerRiotAccountsCard({ playerId, playerHandle, accounts, canEdit }: { playerId: number; playerHandle: string; accounts: PersonAccount[]; canEdit: boolean }) {
  const game = useGame();
  const t = useTranslations("admin.players.edit");
  const riotText = useRiotErrorText();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [riotId, setRiotId] = useState("");
  const [cluster, setCluster] = useState<RiotCluster | null>(null);
  const [removing, setRemoving] = useState<PersonAccount | null>(null);

  function errorText(result: Extract<AddRiotAccountResult, { ok: false }>): string {
    switch (result.error) {
      case "heldByOther":
        return result.holder ? t("riotAccountErrorHeldByOther", { handle: result.holder }) : t("riotAccountErrorGeneric");
      case "alreadyOnPlayer":
        return t("riotAccountErrorAlreadyOnPlayer");
      default:
        return isRiotErrorKind(result.error) ? riotText(result.error, result.riotId) : t("riotAccountErrorGeneric");
    }
  }

  function handleAdd() {
    if (cluster === null) return;
    startTransition(async () => {
      const result = await addPlayerRiotAccount(game, playerId, riotId, cluster);
      if (!result.ok) {
        toast.error(errorText(result));
        return;
      }
      setRiotId("");
      toast.success(t("riotAccountAdded"));
      router.refresh();
    });
  }

  function handleRemove() {
    if (!removing) return;
    const puuid = removing.puuid;
    setRemoving(null);
    startTransition(async () => {
      const result = await removePlayerRiotAccount(game, playerId, puuid);
      if (!result.ok) {
        toast.error(t("riotAccountErrorGeneric"));
        return;
      }
      toast.success(t("riotAccountRemoved"));
      router.refresh();
    });
  }

  const sourceLabel = (source: string) => (source === "admin" ? t("riotAccountSourceAdmin") : source === "leaguepedia" ? "Leaguepedia" : source === "riot" ? "Riot" : source);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("sectionRiotAccounts")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">{t("riotAccountsHint")}</p>

        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("riotAccountsEmpty")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {accounts.map((account) => (
              <div key={account.puuid} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="truncate font-mono text-sm">{account.riotId ?? "—"}</span>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <Badge variant="outline">{account.realm === "tournament" ? t("riotAccountTournament") : t("riotAccountLive")}</Badge>
                    {account.platform && <span>{account.platform}</span>}
                    <span>{sourceLabel(account.source)}</span>
                    {account.lastSeenAt && <span>{t.rich("riotAccountLastSeen", { date: () => <FormattedDate date={account.lastSeenAt} mode="date" /> })}</span>}
                  </div>
                </div>
                {canEdit && (
                  <Button variant="ghost" size="sm" disabled={isPending} onClick={() => setRemoving(account)} aria-label={t("riotAccountRemove")} title={t("riotAccountRemove")} className="shrink-0 text-destructive hover:text-destructive">
                    <Trash2Icon />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {canEdit && (
          <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row">
            <Input value={riotId} onChange={(e) => setRiotId(e.target.value)} placeholder="name#tag" aria-label={t("riotAccountIdLabel")} className="font-mono text-xs sm:flex-1" />
            <Select items={RIOT_CLUSTER_NAMES} value={cluster ?? ""} onValueChange={(value) => setCluster(value as RiotCluster)}>
              <SelectTrigger className="sm:w-36" aria-label={t("riotAccountRegionLabel")}>
                <SelectValue placeholder={t("riotAccountRegionLabel")} />
              </SelectTrigger>
              <SelectContent>
                {RIOT_CLUSTERS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {RIOT_CLUSTER_NAMES[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleAdd} disabled={isPending || riotId.trim() === "" || cluster === null}>
              {isPending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
              {isPending ? t("riotAccountAdding") : t("riotAccountAdd")}
            </Button>
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t("riotAccountRemoveTitle")}
        description={t("riotAccountRemoveDescription", { riotId: removing?.riotId ?? "—", handle: playerHandle })}
        confirmLabel={t("riotAccountRemove")}
        cancelLabel={t("cancel")}
        onConfirm={handleRemove}
        isPending={isPending}
      />
    </Card>
  );
}

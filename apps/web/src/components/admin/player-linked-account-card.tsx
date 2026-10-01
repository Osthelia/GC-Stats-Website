/**
 * GC-Stats - player-linked-account-card
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UserPicker } from "@/components/admin/user-picker";
import { linkUserToPlayer, unlinkUserFromPlayer } from "@/actions/admin-players";
import type { AdminLinkedUser } from "@/lib/admin-players";

export function PlayerLinkedAccountCard({ playerId, linkedUser }: { playerId: number; linkedUser: AdminLinkedUser | null }) {
  const t = useTranslations("admin.players.edit");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [picked, setPicked] = useState<{ id: string; username: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false);

  function handleLink() {
    if (!picked) return;
    setError(null);
    startTransition(async () => {
      const result = await linkUserToPlayer(playerId, picked.id);
      if (!result.ok) {
        setError(t(`error.${result.error}` as "error.invalid"));
        return;
      }
      setPicked(null);
      toast.success(t("linkedAccountLink"));
      router.refresh();
    });
  }

  function handleUnlink() {
    if (!linkedUser) return;
    setUnlinkConfirmOpen(true);
  }

  function confirmUnlink() {
    setUnlinkConfirmOpen(false);
    startTransition(async () => {
      const result = await unlinkUserFromPlayer(playerId);
      if (!result.ok) {
        toast.error(t(`error.${result.error}` as "error.invalid"));
        return;
      }
      toast.success(t("linkedAccountUnlink"));
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("sectionLinkedAccount")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {linkedUser ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
            <div className="flex flex-col">
              <span className="font-medium">{linkedUser.username ?? "—"}</span>
              {linkedUser.email && <span className="text-xs text-muted-foreground">{linkedUser.email}</span>}
            </div>
            <Button variant="ghost" size="sm" disabled={isPending} onClick={handleUnlink} className="text-destructive hover:text-destructive">
              {t("linkedAccountUnlink")}
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t("linkedAccountNone")}</p>
            <div className="flex items-center gap-2">
              <UserPicker
                value={picked}
                onChange={setPicked}
                placeholder={t("linkedAccountPlaceholder")}
                searchPlaceholder={t("linkedAccountSearchPlaceholder")}
                noResultsLabel={t("linkedAccountNoResults")}
              />
              <Button variant="outline" size="sm" disabled={isPending || !picked} onClick={handleLink}>
                {t("linkedAccountLink")}
              </Button>
            </div>
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
          </>
        )}
      </CardContent>

      {linkedUser && (
        <ConfirmDialog
          open={unlinkConfirmOpen}
          onOpenChange={setUnlinkConfirmOpen}
          title={t("confirmTitle")}
          description={t("linkedAccountUnlinkConfirm", { username: linkedUser.username ?? linkedUser.email ?? linkedUser.id })}
          confirmLabel={t("linkedAccountUnlink")}
          cancelLabel={t("cancel")}
          onConfirm={confirmUnlink}
          isPending={isPending}
        />
      )}
    </Card>
  );
}

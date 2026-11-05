/**
 * GC-Stats - public-api-key-actions
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BarChart3, Ban, PauseCircle, PlayCircle, ShieldCheck, Trash2 } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deletePublicApiKey, setPublicApiKeySuspended, setUserApiAccessBlocked, type AdminPublicApiKeyResult } from "@/actions/admin-public-api-keys";
import type { AdminPublicApiKeyRow } from "@/lib/admin-public-api-keys";

type PendingAction = "suspend" | "unsuspend" | "block" | "unblock" | "delete";

/** Moderation buttons of a public key. `showStats` is off on the key page itself, which redirects to the list after a delete. */
export function PublicApiKeyActions({ apiKey, canManage, showStats = true }: { apiKey: AdminPublicApiKeyRow; canManage: boolean; showStats?: boolean }) {
  const t = useTranslations("admin.publicApiKeys");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<PendingAction | null>(null);

  function run(action: PendingAction) {
    startTransition(async () => {
      let result: AdminPublicApiKeyResult;
      try {
        if (action === "delete") result = await deletePublicApiKey(apiKey.id);
        else if (action === "suspend" || action === "unsuspend") result = await setPublicApiKeySuspended(apiKey.id, action === "suspend");
        else result = await setUserApiAccessBlocked(apiKey.userId, action === "block");
      } catch {
        toast.error(t("actionFailed"));
        return;
      }
      setConfirming(null);
      if (!result.ok) {
        toast.error(t("notFound"));
        return;
      }
      toast.success(t(`done.${action}`));
      if (action === "delete" && !showStats) router.push("/admin/api-keys/public");
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {showStats && (
        <Button variant="outline" size="sm" render={<Link href={`/admin/api-keys/${apiKey.id}`} />}>
          <BarChart3 />
          {t("statsAndEdit")}
        </Button>
      )}
      {canManage && (
        <>
          {apiKey.suspended ? (
            <Button variant="outline" size="sm" disabled={isPending} onClick={() => setConfirming("unsuspend")}>
              <PlayCircle />
              {t("unsuspend")}
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled={isPending} onClick={() => setConfirming("suspend")}>
              <PauseCircle />
              {t("suspend")}
            </Button>
          )}
          {apiKey.userId &&
            (apiKey.ownerBlocked ? (
              <Button variant="outline" size="sm" disabled={isPending} onClick={() => setConfirming("unblock")}>
                <ShieldCheck />
                {t("unblock")}
              </Button>
            ) : (
              <Button variant="destructive" size="sm" disabled={isPending} onClick={() => setConfirming("block")}>
                <Ban />
                {t("block")}
              </Button>
            ))}
          <Button variant="destructive" size="sm" disabled={isPending} onClick={() => setConfirming("delete")}>
            <Trash2 />
            {t("delete")}
          </Button>
        </>
      )}

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={confirming ? t(`confirm.${confirming}.title`) : ""}
        description={confirming ? t(`confirm.${confirming}.description`, { name: apiKey.clientName, owner: apiKey.username ?? apiKey.email ?? "-" }) : ""}
        confirmLabel={confirming ? t(confirming) : ""}
        cancelLabel={t("cancel")}
        onConfirm={() => confirming && run(confirming)}
        isPending={isPending}
        destructive={confirming === "block" || confirming === "delete" || confirming === "suspend"}
      />
    </div>
  );
}

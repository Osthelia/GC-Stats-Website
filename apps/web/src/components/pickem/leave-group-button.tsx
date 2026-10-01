/**
 * GC-Stats - leave-group-button
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
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { leavePickemGroup } from "@/actions/pickem";

export function LeaveGroupButton({ groupId, redirectHref }: { groupId: number; redirectHref: string }) {
  const t = useTranslations("pickemPage.groups");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleLeave() {
    startTransition(async () => {
      const result = await leavePickemGroup(groupId);
      if (!result.ok) {
        setConfirmOpen(false);
        toast.error(t(`leaveError.${result.error}`));
        return;
      }
      toast.success(t("leaveSuccess"));
      router.push(redirectHref);
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)} disabled={isPending} className="text-destructive hover:text-destructive">
        {isPending ? t("leaving") : t("leaveButton")}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("leaveButton")}
        description={t("leaveConfirm")}
        confirmLabel={t("leaveButton")}
        cancelLabel={t("cancel")}
        onConfirm={handleLeave}
        isPending={isPending}
        destructive
      />
    </>
  );
}

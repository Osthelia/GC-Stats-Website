/**
 * GC-Stats - team-delete-button
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
import { deleteTeam } from "@/actions/admin-teams";

export function TeamDeleteButton({ teamId, teamName }: { teamId: number; teamName: string }) {
  const t = useTranslations("admin.teams.edit");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteTeam(teamId);
      if (!result.ok) {
        setConfirmOpen(false);
        toast.error(t(`deleteError.${result.error}`));
        return;
      }
      toast.success(t("deleteSuccess"));
      router.push("/admin/teams");
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" disabled={isPending} onClick={() => setConfirmOpen(true)} className="text-destructive hover:text-destructive">
        {t("delete")}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("confirmTitle")}
        description={t("deleteConfirm", { name: teamName })}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        onConfirm={handleDelete}
        isPending={isPending}
        destructive
      />
    </>
  );
}

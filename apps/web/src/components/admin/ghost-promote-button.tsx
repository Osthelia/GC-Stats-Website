/**
 * GC-Stats - ghost-promote-button
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
import { promoteGhostPlayer, promoteGhostTeam } from "@/actions/admin-ghost-matches";

/** Turns a ghost team or player into a regular public profile. */
export function GhostPromoteButton({ kind, id, name }: { kind: "team" | "player"; id: number; name: string }) {
  const t = useTranslations("admin.ghost");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handlePromote() {
    startTransition(async () => {
      const result = kind === "team" ? await promoteGhostTeam(id) : await promoteGhostPlayer(id);
      setConfirmOpen(false);
      if (!result.ok) {
        toast.error(t(`promoteError.${result.error}`));
        return;
      }
      toast.success(t("promoteSuccess"));
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" disabled={isPending} onClick={() => setConfirmOpen(true)}>
        {t("promote")}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("promoteTitle")}
        description={t("promoteConfirm", { name })}
        confirmLabel={t("promote")}
        cancelLabel={t("cancel")}
        onConfirm={handlePromote}
        isPending={isPending}
      />
    </>
  );
}

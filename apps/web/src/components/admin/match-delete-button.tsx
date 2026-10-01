/**
 * GC-Stats - match-delete-button
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { deleteMatch } from "@/actions/admin-matches";

export function MatchDeleteButton({ matchId, tournamentId }: { matchId: number; tournamentId: number }) {
  const t = useTranslations("admin.tournaments.matches");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(t("deleteConfirm"))) return;
    startTransition(async () => {
      const result = await deleteMatch(matchId);
      if (!result.ok) {
        toast.error(t(`deleteError.${result.error}`));
        return;
      }
      toast.success(t("deleteSuccess"));
      router.push(`/admin/tournaments/${tournamentId}/bracket-editor`);
    });
  }

  return (
    <Button variant="outline" disabled={isPending} onClick={handleDelete} className="text-destructive hover:text-destructive">
      {t("deleteButton")}
    </Button>
  );
}

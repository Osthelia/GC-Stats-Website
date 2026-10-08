/**
 * GC-Stats - roster-conflict-dialog
 *
 * Asks whether the other current teams of a person must be closed when a
 * roster entry without end date is saved.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getRosterConflicts, type RosterConflict } from "@/actions/admin-teams";

type Request = { handle: string; conflicts: RosterConflict[]; resolve: (ids: number[] | null) => void };

/**
 * `resolveConflicts` returns the membership ids to close (empty to keep them
 * open), or null when the user cancels the save.
 */
export function useRosterConflicts() {
  const [request, setRequest] = useState<Request | null>(null);

  const resolveConflicts = useCallback(async (personId: number, handle: string, teamId: number, excludeMembershipId?: number): Promise<number[] | null> => {
    const conflicts = await getRosterConflicts(personId, teamId, excludeMembershipId);
    if (conflicts.length === 0) return [];
    return new Promise((resolve) => setRequest({ handle, conflicts, resolve }));
  }, []);

  function answer(ids: number[] | null) {
    request?.resolve(ids);
    setRequest(null);
  }

  const dialog = <RosterConflictDialog request={request} onAnswer={answer} />;
  return { resolveConflicts, dialog };
}

function RosterConflictDialog({ request, onAnswer }: { request: Request | null; onAnswer: (ids: number[] | null) => void }) {
  const t = useTranslations("admin.teams.edit");

  return (
    <AlertDialog open={!!request} onOpenChange={(open) => !open && onAnswer(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("conflictTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("conflictDescription", { handle: request?.handle ?? "" })}</AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="flex flex-col gap-1 text-sm">
          {request?.conflicts.map((c) => (
            <li key={c.membershipId} className="rounded-md border px-3 py-2">
              {t("conflictItem", { team: c.teamName, role: t(`role.${c.role}` as "role.player") })}
            </li>
          ))}
        </ul>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onAnswer(null)}>
            {t("cancel")}
          </Button>
          <Button variant="outline" onClick={() => onAnswer([])}>
            {t("conflictKeep")}
          </Button>
          <Button onClick={() => onAnswer(request?.conflicts.map((c) => c.membershipId) ?? [])}>{t("conflictClose")}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

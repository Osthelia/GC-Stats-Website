/**
 * GC-Stats - groups-actions
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CreateGroupDialog } from "@/components/pickem/create-group-dialog";
import { JoinGroupDialog } from "@/components/pickem/join-group-dialog";

export function GroupsActions({ tournamentId }: { tournamentId: number }) {
  const t = useTranslations("pickemPage.groups");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={() => setJoining(true)}>
        {t("joinButton")}
      </Button>
      <Button onClick={() => setCreating(true)}>{t("createButton")}</Button>

      <CreateGroupDialog tournamentId={tournamentId} open={creating} onOpenChange={setCreating} />
      <JoinGroupDialog open={joining} onOpenChange={setJoining} />
    </div>
  );
}

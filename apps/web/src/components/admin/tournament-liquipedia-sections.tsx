/**
 * GC-Stats - tournament-liquipedia-sections
 *
 * Switches the tournament Liquipedia page between its teams, its players
 * and staff, its broadcast talent and its brackets.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LiquipediaImportBar } from "@/components/admin/liquipedia-import-bar";
import { TournamentLiquipediaPanel } from "@/components/admin/tournament-liquipedia-panel";
import { TournamentLiquipediaPeoplePanel } from "@/components/admin/tournament-liquipedia-people-panel";
import { TournamentLiquipediaTalentPanel } from "@/components/admin/tournament-liquipedia-talent-panel";
import { TournamentLiquipediaBracketsPanel } from "@/components/admin/tournament-liquipedia-brackets-panel";
import type { LiquipediaBracketGroup, LiquipediaStage, LiquipediaTournamentPerson } from "@/lib/admin-liquipedia";

export function TournamentLiquipediaSections({
  tournamentId,
  stages,
  people,
  brackets,
  canManage,
}: {
  tournamentId: number;
  stages: LiquipediaStage[];
  people: LiquipediaTournamentPerson[];
  brackets: LiquipediaBracketGroup[];
  canManage: boolean;
}) {
  const t = useTranslations("admin.tournaments.liquipedia");
  const [section, setSection] = useState<"teams" | "people" | "talent" | "brackets">("teams");

  return (
    <div className="flex flex-col gap-4">
      {canManage && <LiquipediaImportBar tournamentId={tournamentId} />}
      <Tabs value={section} onValueChange={(value) => setSection(value as "teams" | "people" | "talent" | "brackets")}>
        <TabsList>
          <TabsTrigger value="teams">{t("teamsTab")}</TabsTrigger>
          <TabsTrigger value="people">{t("people.tab")}</TabsTrigger>
          <TabsTrigger value="talent">{t("talent.tab")}</TabsTrigger>
          <TabsTrigger value="brackets">{t("brackets.tab")}</TabsTrigger>
        </TabsList>
      </Tabs>
      {section === "teams" ? (
        <TournamentLiquipediaPanel tournamentId={tournamentId} stages={stages} canManage={canManage} />
      ) : section === "people" ? (
        <TournamentLiquipediaPeoplePanel tournamentId={tournamentId} people={people} canManage={canManage} />
      ) : section === "talent" ? (
        <TournamentLiquipediaTalentPanel tournamentId={tournamentId} canManage={canManage} />
      ) : (
        <TournamentLiquipediaBracketsPanel tournamentId={tournamentId} brackets={brackets} canManage={canManage} />
      )}
    </div>
  );
}

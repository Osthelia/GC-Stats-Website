"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { TeamPicker } from "@/components/admin/team-picker";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { searchCalendarTeams } from "@/actions/calendar";
import type { TeamPickerResult } from "@/lib/team-search";

type TeamSelection = { id: number; name: string };
type SearchMessage = "searchPage.typeAhead" | "admin.teams.noResults" | "calendar.teamSearchError";

export function CalendarTeamFilter({ selectedTeam }: { selectedTeam: TeamSelection | null }) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchMessage, setSearchMessage] = useState<SearchMessage>("searchPage.typeAhead");
  const searchRequest = useRef(0);

  async function search(query: string) {
    const request = ++searchRequest.current;
    let message: SearchMessage = query.trim().length < 2 ? "searchPage.typeAhead" : "admin.teams.noResults";
    let results: TeamPickerResult[] = [];
    try {
      if (message === "admin.teams.noResults") results = await searchCalendarTeams(query);
    } catch {
      message = "calendar.teamSearchError";
    }
    if (request === searchRequest.current) setSearchMessage(message);
    return results;
  }

  function changeTeam(team: TeamSelection | null) {
    const query = new URLSearchParams(searchParams.toString());
    if (team) query.set("team", String(team.id));
    else query.delete("team");
    router.push(`/calendar${query.size ? `?${query}` : ""}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-64 max-w-full">
        <TeamPicker
          value={selectedTeam}
          onChange={changeTeam}
          search={search}
          placeholder={t("calendar.allTeams")}
          searchPlaceholder={t("calendar.searchTeams")}
          noResultsLabel={t(searchMessage)}
        />
      </div>
      {selectedTeam && (
        <Button variant="outline" size="sm" onClick={() => changeTeam(null)}>{t("calendar.allTeams")}</Button>
      )}
    </div>
  );
}

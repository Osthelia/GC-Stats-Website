import { describe, expect, it } from "vitest";
import { rankLeaguepediaGames, type SeriesEntrant } from "./series-entrants";

const entrants: SeriesEntrant[] = [
  { id: 1, name: "Barcząca Babylon", teamId: 10, names: ["Barcząca Babylon", "BBL"], leaguepediaName: null },
  { id: 2, name: "Nova Gaming", teamId: 20, names: ["Nova Gaming", "NOVA"], leaguepediaName: "Nova Esports" },
];

const game = (id: string, team1: string, team2: string, playedAt: string | null) => ({ id, team1, team2, playedAt });

describe("rankLeaguepediaGames", () => {
  const list = [
    game("other-1", "Team Alpha", "Team Beta", "2026-03-10T17:00:00Z"),
    game("rematch-1", "Barcząca Babylon", "Nova Esports", "2026-03-20T17:00:00Z"),
    game("series-1", "Barcząca Babylon", "Nova Esports", "2026-03-14T17:05:00Z"),
    game("series-2", "Nova Esports", "Barcząca Babylon", "2026-03-14T17:50:00Z"),
    game("half-1", "Barcząca Babylon", "Team Alpha", "2026-03-14T15:00:00Z"),
  ];

  it("puts the series' games first, closest to its date, then games with one of its teams", () => {
    const ranked = rankLeaguepediaGames(list, entrants, "2026-03-14T17:00:00Z");
    expect(ranked.map((g) => g.id)).toEqual(["series-1", "series-2", "rematch-1", "half-1", "other-1"]);
  });

  it("uses the Leaguepedia name an earlier import linked", () => {
    const ranked = rankLeaguepediaGames([game("x", "Team Alpha", "Team Beta", null), game("y", "Nova Esports", "Barcząca Babylon", null)], entrants, null);
    expect(ranked[0]!.id).toBe("y");
  });

  it("keeps the list order without a scheduled time", () => {
    const ranked = rankLeaguepediaGames(list, entrants, null);
    expect(ranked.map((g) => g.id)).toEqual(["rematch-1", "series-1", "series-2", "half-1", "other-1"]);
  });
});

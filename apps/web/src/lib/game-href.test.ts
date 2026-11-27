import { describe, expect, it } from "vitest";
import { isLegacyEntityPath } from "./game-href";

describe("isLegacyEntityPath", () => {
  it.each([
    "/team/3",
    "/player/6/handle/stats",
    "/match/12",
    "/tournaments/123/vct-masters",
    "/news/some-slug",
    "/news/publisher/some-slug",
    "/organization/2/gc-stats",
    "/widget",
    "/admin/teams/3",
    "/admin/tournaments/4/matches",
    "/dashboard/2/news/9",
    "/dashboard/author/9",
    "/dashboard/authors/3/9",
  ])("sends %s to the default game", (path) => {
    expect(isLegacyEntityPath(path)).toBe(true);
  });

  it.each([
    "/search",
    "/team",
    "/match",
    "/news",
    "/tournaments",
    "/user/someone/news",
    "/admin",
    "/admin/players",
    "/admin/players/duplicates",
    "/dashboard/2/news",
    "/dashboard/2/news/new",
    "/dashboard/author",
    "/dashboard/authors/3",
  ])("leaves %s to the preferred game", (path) => {
    expect(isLegacyEntityPath(path)).toBe(false);
  });
});

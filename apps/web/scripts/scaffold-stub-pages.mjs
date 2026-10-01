// One-off scaffolding script — not part of the build. Generates stub
// page.tsx files for every route inventoried from V1's routes/web.php
// (see SUIVI.md). Re-run only if you need to regenerate a wiped stub;
// once a route gets real content, its file is no longer "generated".
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const APP_DIR = join(import.meta.dirname, "..", "src", "app", "[locale]");

// Route path (Next.js segment syntax) -> label shown on the stub.
// Replaces V1's separate "optional slug segment before a fixed subpage"
// (e.g. /tournaments/{id}/{slug?}/matches) with the slug baked into the SAME
// segment as the id (e.g. /tournaments/123-vct-masters/matches) — one
// dynamic param per level instead of two route variants per page, and the
// slug still shows up on every subpage for sharing. Never validated: only
// the leading numeric id is read (see src/lib/entity-id.ts), so a stale or
// wrong slug in an old shared link still resolves instead of 404ing.
const ROUTES = [
  "tournaments",
  "tournaments/[tournamentId]",
  "tournaments/[tournamentId]/matches",
  "tournaments/[tournamentId]/stats",
  "tournaments/[tournamentId]/maps",
  "team/[teamId]",
  "team/[teamId]/history",
  "team/[teamId]/matches",
  "team/[teamId]/maps",
  "player/[playerId]",
  "player/[playerId]/history",
  "player/[playerId]/matches",
  "player/[playerId]/stats",
  "user/[username]",
  "user/[username]/news",
  "match/[matchId]",
  "widget",
  "widget/head-to-head",
  "widget/heatmap",
  "widget/heatmap/preview",
  "search",
  "news/[slug]",
  "news/author/[slug]",
  "news/publisher/[slug]",
  "forum",
  "forum/rules",
  "forum/general",
  "forum/general/create",
  "forum/threads/[threadId]",
  "about",
  "transparency",
  "finance",
  "terms",
  "legal",
  "privacy",
  "data",
  "takedown",
  "help/edit_page",
  "help/add_tournament",
  "developers-doc",
  "login",
  "register",
];

const stubContent = (routeLabel) => `import { PageStub } from "@/components/page-stub";

export default function Page() {
  return <PageStub route="/${routeLabel}" />;
}
`;

for (const route of ROUTES) {
  const dir = join(APP_DIR, route);
  await mkdir(dir, { recursive: true });
  const file = join(dir, "page.tsx");
  await writeFile(file, stubContent(route), "utf8");
}

console.log(`Scaffolded ${ROUTES.length} stub pages under ${APP_DIR}`);

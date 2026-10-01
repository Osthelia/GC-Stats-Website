/**
 * GC-Stats - layout
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { notFound } from "next/navigation";
import { parseEntityId, slugify } from "@/lib/entity-id";
import { getTeamPageInfo, getTeamAchievements } from "@/lib/team-page-data";
import { TeamHeader } from "@/components/team/team-header";

/** Header shared by every team tab, kept across tab changes instead of being rebuilt by each page. */
export default async function TeamTabsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const id = parseEntityId(teamId);
  if (id === null) notFound();

  const [team, achievements] = await Promise.all([getTeamPageInfo(id), getTeamAchievements(id)]);
  if (!team) notFound();

  return (
    <div>
      <TeamHeader team={team} segment={`${team.id}/${slugify(team.name)}`} achievements={achievements} />
      {children}
    </div>
  );
}

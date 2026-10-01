/**
 * GC-Stats - pickem-leaderboard-table
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { LeaderboardEntry } from "@/lib/pickem/pickem-data";

const REWARD_BADGE_CLASS: Record<string, string> = {
  top1pct: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  top5pct: "bg-slate-400/15 text-slate-300 border-slate-400/30",
  perfect: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

export async function PickemLeaderboardTable({ entries, rewardsByUserId, currentUserId }: { entries: LeaderboardEntry[]; rewardsByUserId?: Map<string, string[]>; currentUserId?: string | null }) {
  const t = await getTranslations("pickemPage");

  if (entries.length === 0) {
    return <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">{t("leaderboardEmpty")}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("leaderboardRank")}</TableHead>
            <TableHead>{t("leaderboardUser")}</TableHead>
            <TableHead>{t("leaderboardScore")}</TableHead>
            <TableHead>{t("leaderboardRewards")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const rank = 1 + entries.filter((e) => e.score > entry.score).length;
            const rewards = rewardsByUserId?.get(entry.userId) ?? [];
            return (
              <TableRow key={entry.userId} className={entry.userId === currentUserId ? "bg-primary/5" : "odd:bg-muted/20"}>
                <TableCell className="text-sm text-muted-foreground">{rank}</TableCell>
                <TableCell className="font-medium">{entry.username ?? t("unknownUser")}</TableCell>
                <TableCell className="text-sm">{entry.score}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {rewards.map((kind) => (
                      <Badge key={kind} className={REWARD_BADGE_CLASS[kind] ?? ""}>
                        {t(`rewardKind.${kind}`)}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

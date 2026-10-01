/**
 * GC-Stats - user-reward-badges
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import type { UserRewardRow } from "@/lib/pickem/rewards";

const REWARD_BADGE_CLASS: Record<string, string> = {
  top1pct: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  top5pct: "bg-slate-400/15 text-slate-300 border-slate-400/30",
  perfect: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

/** Self-contained badge label (tournament + phase name), used outside the phase's own page where that context isn't implicit. */
export async function UserRewardBadges({ rewards }: { rewards: UserRewardRow[] }) {
  if (rewards.length === 0) return null;

  const t = await getTranslations("pickemPage");

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-neutral-800 bg-[var(--gcs-surface)] px-4 py-3.5">
      <span className="font-mono text-[10px] tracking-[0.12em] text-neutral-500 uppercase">{t("rewardsTitle")}</span>
      <div className="flex flex-wrap gap-1.5">
        {rewards.map((r, i) => (
          <Link key={i} href={r.tournamentHref} title={`${r.tournamentName}, ${r.stageName}`}>
            <Badge className={REWARD_BADGE_CLASS[r.kind] ?? ""}>
              {t(`rewardKind.${r.kind}`)} · {r.tournamentName}, {r.stageName}
            </Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}

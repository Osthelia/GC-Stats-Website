/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getUserProfileByUsername, getUserProfileStats } from "@/lib/user-profile-data";
import { getUserRewards } from "@/lib/pickem/rewards";
import { UserProfileHeader } from "@/components/user/user-profile-header";
import { UserRewardBadges } from "@/components/pickem/user-reward-badges";
import { FormattedDate } from "@/components/formatted-date";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; username: string }> }): Promise<Metadata> {
  const { locale, username } = await params;
  const user = await getUserProfileByUsername(username);
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "userPage" });
  return { title: user ? (user.name ?? user.username) : t("tabOverview") };
}

export default async function UserProfilePage({ params }: { params: Promise<{ locale: string; username: string }> }) {
  const { locale, username } = await params;
  setRequestLocale(locale as AppLocale);

  const user = await getUserProfileByUsername(username);
  if (!user) notFound();

  const [stats, rewards, t] = await Promise.all([getUserProfileStats(user.id), getUserRewards(user.id), getTranslations("userPage")]);

  return (
    <div>
      <UserProfileHeader user={user} activeTab="overview" hasNewsTab={stats.hasNewsArticles} />

      <div className="mx-auto max-w-[1400px] px-6 py-7 pb-[70px]">
        <div className="flex flex-wrap gap-3">
          <div className="flex min-w-[180px] flex-1 flex-col gap-1 rounded-xl border border-neutral-800 bg-[var(--gcs-surface)] px-4 py-3.5">
            <span className="font-mono text-[10px] tracking-[0.12em] text-neutral-500 uppercase">{t("memberSince")}</span>
            <span className="text-[15px] font-semibold text-neutral-100">
              <FormattedDate date={user.createdAt} mode="date" />
            </span>
          </div>

          {stats.forumMessageCount > 0 && (
            <div className="flex min-w-[180px] flex-1 flex-col gap-1 rounded-xl border border-neutral-800 bg-[var(--gcs-surface)] px-4 py-3.5">
              <span className="font-mono text-[10px] tracking-[0.12em] text-neutral-500 uppercase">{t("forumPosts")}</span>
              <span className="text-[15px] font-semibold text-neutral-100">{stats.forumMessageCount}</span>
            </div>
          )}

          {stats.hasNewsArticles && (
            <Link
              href={`/user/${user.username}/news`}
              className="flex min-w-[180px] flex-1 flex-col gap-1 rounded-xl border border-neutral-800 bg-[var(--gcs-surface)] px-4 py-3.5 transition-colors hover:border-neutral-700"
            >
              <span className="font-mono text-[10px] tracking-[0.12em] text-neutral-500 uppercase">{t("tabNews")}</span>
              <span className="text-[15px] font-semibold text-[#e4ae22]">{t("seeArticles")} →</span>
            </Link>
          )}
        </div>

        {rewards.length > 0 && (
          <div className="mt-3">
            <UserRewardBadges rewards={rewards} />
          </div>
        )}
      </div>
    </div>
  );
}

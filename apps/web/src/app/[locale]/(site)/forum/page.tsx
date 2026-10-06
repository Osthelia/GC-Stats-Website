/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getForumOverview } from "@/lib/forum-data";
import { ForumAvatar } from "@/components/forum/forum-avatar";
import { FormattedDate } from "@/components/formatted-date";
import { staticTitleMetadata } from "@/lib/page-metadata";

export const generateMetadata = staticTitleMetadata("forum.overview.title");

export default async function ForumPage() {
  const t = await getTranslations("forum.overview");
  const { totalThreads, totalMessages, latestThreads } =
    await getForumOverview();

  return (
    <div className="mx-auto max-w-[900px] px-6 py-10">
      <h1 className="mb-1 text-2xl font-black text-neutral-50">{t("title")}</h1>
      <p className="mb-6 text-sm text-[var(--gcs-text-tertiary)]">
        {t("stats", { threads: totalThreads, messages: totalMessages })}
      </p>

      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          href="/forum/general"
          className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-2xl border border-neutral-800 bg-[var(--gcs-surface)] p-5 transition-colors hover:border-neutral-700 hover:bg-[var(--gcs-hover)] active:scale-[0.99]"
        >
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-neutral-50">
              {t("generalCategory")}
            </h2>
            <p className="text-[13px] text-neutral-400">
              {t("generalCategoryHint")}
            </p>
          </div>
          <span className="flex-none text-[13px] font-semibold text-[#e4ae22]">
            {t("browse")}
          </span>
        </Link>
        <Link
          href="/forum/rules"
          className="flex-none rounded-[9px] border border-neutral-800 bg-[var(--gcs-surface)] px-4 py-2.5 text-center text-[13.5px] font-medium text-neutral-300 transition-colors hover:border-neutral-700 hover:text-neutral-50 active:scale-[0.98]"
        >
          {t("rulesLink")}
        </Link>
      </div>

      <h2 className="mb-3 text-[13px] font-black tracking-widest text-neutral-500 uppercase">
        {t("latestThreads")}
      </h2>

      {latestThreads.length === 0 ? (
        <p className="rounded-xl border border-neutral-800 bg-[var(--gcs-surface)] px-4 py-10 text-center text-sm text-[var(--gcs-text-tertiary)]">
          {t("noThreads")}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {latestThreads.map((thread) => (
            <Link
              key={thread.id}
              href={`/forum/threads/${thread.id}`}
              className="flex items-center gap-3 rounded-xl border border-neutral-800/70 bg-[var(--gcs-surface-3)] p-3.5 transition-all hover:translate-x-1 hover:border-neutral-700"
            >
              <ForumAvatar
                username={thread.authorUsername}
                image={thread.authorImage}
                size={28}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-neutral-50">
                  {thread.title}
                </p>
                <p className="text-[12px] text-neutral-500">
                  {thread.authorUsername ?? t("deletedAccount")}
                </p>
              </div>
              <div className="flex-none text-right">
                <p className="text-[12px] font-medium text-neutral-400">
                  {t("replyCount", { count: thread.messageCount })}
                </p>
                <p className="text-[11px] text-neutral-600">
                  <FormattedDate date={thread.lastMessageAt} mode="date" />
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth } from "@/auth";
import { getForumThreadsPage, FORUM_THREADS_PAGE_SIZE } from "@/lib/forum-data";
import { ForumAvatar } from "@/components/forum/forum-avatar";
import { FormattedDate } from "@/components/formatted-date";
import { ListPagination } from "@/components/filters/list-pagination";

export default async function ForumGeneralPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams;
  const t = await getTranslations("forum.general");
  const session = await auth();

  const page = Math.max(1, Number(sp.page) || 1);
  const { threads, total } = await getForumThreadsPage(page);
  const totalPages = Math.max(1, Math.ceil(total / FORUM_THREADS_PAGE_SIZE));

  return (
    <div className="mx-auto max-w-[900px] px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-black text-neutral-50">{t("title")}</h1>
          <p className="text-sm text-[var(--gcs-text-tertiary)]">{t("resultsCount", { count: total })}</p>
        </div>
        {session?.user?.id ? (
          <Link href="/forum/general/create" className="flex-none rounded-[9px] bg-[#e4ae22] px-4 py-2.5 text-[13.5px] font-semibold text-[#0e0e0e] transition-colors hover:bg-[#c9981d]">
            {t("newThread")}
          </Link>
        ) : (
          <Link
            href="/login"
            className="flex-none rounded-[9px] border border-neutral-800 bg-[var(--gcs-surface)] px-4 py-2.5 text-[13.5px] font-medium text-neutral-300 transition-colors hover:border-neutral-700 hover:text-neutral-50"
          >
            {t("loginToPost")}
          </Link>
        )}
      </div>

      {threads.length === 0 ? (
        <p className="rounded-xl border border-neutral-800 bg-[var(--gcs-surface)] px-4 py-10 text-center text-sm text-[var(--gcs-text-tertiary)]">{t("noThreads")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {threads.map((thread) => (
            <Link
              key={thread.id}
              href={`/forum/threads/${thread.id}`}
              className="flex items-center gap-3 rounded-xl border border-neutral-800/70 bg-[var(--gcs-surface-3)] p-3.5 transition-all hover:translate-x-1 hover:border-neutral-700"
            >
              <ForumAvatar username={thread.authorUsername} image={thread.authorImage} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] font-semibold text-neutral-50">{thread.title}</p>
                <p className="text-[12.5px] text-neutral-500">{thread.authorUsername ?? t("deletedAccount")}</p>
              </div>
              <div className="flex-none text-right">
                <p className="text-[12.5px] font-medium text-neutral-400">{t("replyCount", { count: thread.messageCount })}</p>
                <p className="text-[11.5px] text-neutral-600">
                  <FormattedDate date={thread.lastMessageAt} mode="date" />
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <ListPagination
        page={page}
        totalPages={totalPages}
        prevHref={`/forum/general?page=${page - 1}`}
        nextHref={`/forum/general?page=${page + 1}`}
        previousLabel={t("previous")}
        nextLabel={t("next")}
        pageOfLabel={t("pageOf", { page, total: totalPages })}
      />
    </div>
  );
}

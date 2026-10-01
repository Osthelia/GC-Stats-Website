/**
 * GC-Stats - forum-thread-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { getForumMessagesPage, FORUM_MESSAGES_PAGE_SIZE } from "@/lib/forum-data";
import { getForumPostStatus } from "@/lib/forum-guards";
import { getActiveEmotesForPicker } from "@/lib/reactions";
import { ForumMessageItem } from "@/components/forum/forum-message-item";
import { ForumPostGate } from "@/components/forum/forum-post-gate";
import { ReplyForm } from "@/components/forum/reply-form";
import { ForumReplyProvider } from "@/components/forum/forum-reply-context";
import { ListPagination } from "@/components/filters/list-pagination";

/**
 * Renders one thread's messages, pagination and reply form. Used both by the
 * standalone /forum/threads/{id} page and embedded on match/news/tournament
 * pages (V1 mounts the same forum-thread component both ways, see
 * lib/forum-threads.ts).
 */
export async function ForumThreadPanel({ threadId, page, buildHref }: { threadId: number; page: number; buildHref: (page: number) => string }) {
  const t = await getTranslations("forum.thread");
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const [{ messages, total }, pickerEmotes, status] = await Promise.all([
    getForumMessagesPage(threadId, page, userId),
    getActiveEmotesForPicker(),
    getForumPostStatus(userId),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / FORUM_MESSAGES_PAGE_SIZE));

  return (
    <ForumReplyProvider>
      <div className="flex flex-col gap-3">
        {messages.length === 0 ? (
          <p className="rounded-xl border border-neutral-800 bg-[var(--gcs-surface)] px-4 py-10 text-center text-sm text-[var(--gcs-text-tertiary)]">{t("noMessages")}</p>
        ) : (
          messages.map((message) => <ForumMessageItem key={message.id} message={message} canReport={!!userId} canReply={status === "ok"} pickerEmotes={pickerEmotes} isAuthenticated={!!userId} />)
        )}

        <ListPagination
          page={page}
          totalPages={totalPages}
          prevHref={buildHref(page - 1)}
          nextHref={buildHref(page + 1)}
          previousLabel={t("previous")}
          nextLabel={t("next")}
          pageOfLabel={t("pageOf", { page, total: totalPages })}
        />

        <div className="mt-4">
          <ForumPostGate status={status}>
            <ReplyForm threadId={threadId} pickerEmotes={pickerEmotes} />
          </ForumPostGate>
        </div>
      </div>
    </ForumReplyProvider>
  );
}

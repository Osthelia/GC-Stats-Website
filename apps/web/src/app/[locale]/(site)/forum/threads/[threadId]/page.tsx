/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getForumThread } from "@/lib/forum-data";
import { ForumThreadPanel } from "@/components/forum/forum-thread-panel";
import { UserBadges } from "@/components/user/user-badges";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ threadId: string }> }): Promise<Metadata> {
  const threadId = Number((await params).threadId);
  const thread = Number.isInteger(threadId) ? await getForumThread(threadId) : null;
  return thread && thread.category === "general" ? { title: thread.title } : {};
}

export default async function ForumThreadPage({ params, searchParams }: { params: Promise<{ threadId: string }>; searchParams: Promise<{ page?: string }> }) {
  const { threadId: rawThreadId } = await params;
  const sp = await searchParams;
  const threadId = Number(rawThreadId);
  if (!Number.isInteger(threadId)) notFound();

  const thread = await getForumThread(threadId);
  if (!thread || thread.category !== "general") notFound();

  const t = await getTranslations("forum.thread");
  const page = Math.max(1, Number(sp.page) || 1);

  return (
    <div className="mx-auto max-w-[900px] px-6 py-10">
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-black break-words text-neutral-50">{thread.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--gcs-text-tertiary)]">
          {thread.authorUsername ? (
            <span>
              {t("startedByPrefix")}{" "}
              <Link href={`/user/${thread.authorUsername}`} className="font-medium text-neutral-300 transition-colors hover:text-[#e4ae22]">
                {thread.authorUsername}
              </Link>
            </span>
          ) : (
            <span>{t("startedBy", { username: t("deletedAccount") })}</span>
          )}
          <UserBadges pronouns={thread.authorPronouns} fanTeam={thread.authorFanTeam} size="sm" />
        </div>
      </div>

      <ForumThreadPanel threadId={threadId} page={page} buildHref={(p) => `/forum/threads/${threadId}?page=${p}`} />
    </div>
  );
}

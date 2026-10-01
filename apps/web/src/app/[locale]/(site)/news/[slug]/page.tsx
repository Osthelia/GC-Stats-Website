/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { Suspense } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getPublicNewsArticle } from "@/lib/news-page-data";
import { listActiveNewsLanguages } from "@/lib/news-languages";
import { sanitizeNewsContent } from "@/lib/news-content-sanitize";
import { findOrCreateThreadFor } from "@/lib/forum-threads";
import { FormattedDate } from "@/components/formatted-date";
import { ForumThreadPanel } from "@/components/forum/forum-thread-panel";
import { ThemedLogoImage } from "@/components/site/themed-logo-image";

async function NewsDiscussion({ newsId, slug, page }: { newsId: number; slug: string; page: number }) {
  const threadId = await findOrCreateThreadFor("news", newsId);
  return <ForumThreadPanel threadId={threadId} page={page} buildHref={(p) => `/news/${slug}?discussionPage=${p}`} />;
}

export default async function NewsArticlePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ discussionPage?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const [article, languageOptions] = await Promise.all([getPublicNewsArticle(slug), listActiveNewsLanguages()]);
  if (!article) notFound();
  const languageName = languageOptions.find((l) => l.code === article.lang)?.name ?? article.lang;

  const t = await getTranslations("newsPage.article");
  const discussionPage = Math.max(1, Number(sp.discussionPage) || 1);
  const isPreview = article.status !== "published" || !article.publishedAt || article.publishedAt.getTime() > Date.now();

  return (
    <div className="mx-auto max-w-[860px] px-6 py-10">
      {isPreview && (
        <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-300">{t("previewNotice")}</div>
      )}

      <div className="mb-6 flex items-center gap-2 text-[11px] text-neutral-500">
        <span className="rounded border border-neutral-800 px-1.5 py-0.5 font-semibold tracking-[0.05em] uppercase">{languageName}</span>
        {article.publishedAt && <FormattedDate date={article.publishedAt} mode="date" />}
      </div>

      <h1 className="mb-4 text-3xl font-black tracking-tight text-neutral-50">{article.title}</h1>

      {article.excerpt && <p className="mb-6 text-lg text-neutral-400">{article.excerpt}</p>}

      {article.imageCover && (
        <div className="relative mb-8 aspect-video w-full overflow-hidden rounded-xl bg-black/40">
          <Image src={article.imageCover} alt="" fill sizes="860px" className="object-cover" unoptimized />
        </div>
      )}

      <div className="news-content" dangerouslySetInnerHTML={{ __html: sanitizeNewsContent(article.content) }} />

      {(article.teams.length > 0 || article.people.length > 0 || article.tournaments.length > 0) && (
        <div className="mt-8 flex flex-wrap gap-1.5 border-t border-neutral-800 pt-6">
          {[...article.teams, ...article.people, ...article.tournaments].map((rel) => (
            <Link
              key={`${rel.href}-${rel.id}`}
              href={rel.href}
              className="rounded-full border border-neutral-800 px-3 py-1 text-xs font-medium text-neutral-400 transition-colors hover:border-neutral-700 hover:text-neutral-200"
            >
              {rel.label}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 border-t border-neutral-800 pt-6 sm:grid-cols-2">
        {article.author &&
          (() => {
            const avatar = (
              <span className="flex size-10 flex-none items-center justify-center overflow-hidden rounded-lg bg-white/[0.08] text-sm font-bold text-neutral-300">
                {article.author.logoUrl || article.author.logoUrlLight ? (
                  <ThemedLogoImage
                    dark={article.author.logoUrl ?? article.author.logoUrlLight!}
                    light={article.author.logoUrlLight ?? article.author.logoUrl!}
                    alt=""
                    width={40}
                    height={40}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  article.author.name.charAt(0).toUpperCase()
                )}
              </span>
            );
            const info = (
              <div className="min-w-0">
                <p className="text-[9px] font-black tracking-[0.2em] text-neutral-600 uppercase">{t("writtenBy")}</p>
                <span className="text-sm font-semibold text-neutral-100">{article.author.name}</span>
              </div>
            );
            return article.author.username ? (
              <Link
                href={`/user/${article.author.username}`}
                className="flex items-center gap-3 rounded-xl border border-neutral-800/70 bg-[var(--gcs-surface-3)] p-4 transition-colors hover:border-neutral-700"
              >
                {avatar}
                {info}
              </Link>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-neutral-800/70 bg-[var(--gcs-surface-3)] p-4">
                {avatar}
                {info}
              </div>
            );
          })()}

        {article.publisher && (
          <Link
            href={`/organization/${article.publisher.id}/${article.publisher.slug}`}
            className="flex items-center gap-3 rounded-xl border border-neutral-800/70 bg-[var(--gcs-surface-3)] p-4 transition-colors hover:border-neutral-700"
          >
            <span className="flex size-10 flex-none items-center justify-center overflow-hidden rounded-lg bg-white/[0.08] text-sm font-bold text-neutral-300">
              {article.publisher.logoUrl || article.publisher.logoUrlLight ? (
                <ThemedLogoImage
                  dark={article.publisher.logoUrl ?? article.publisher.logoUrlLight!}
                  light={article.publisher.logoUrlLight ?? article.publisher.logoUrl!}
                  alt=""
                  width={40}
                  height={40}
                  className="h-full w-full object-contain"
                />
              ) : (
                article.publisher.name.charAt(0).toUpperCase()
              )}
            </span>
            <div className="min-w-0">
              <p className="text-[9px] font-black tracking-[0.2em] text-neutral-600 uppercase">{t("publishedBy")}</p>
              <span className="text-sm font-semibold text-neutral-100">{article.publisher.name}</span>
            </div>
          </Link>
        )}
      </div>

      <div className="mt-10 border-t border-neutral-800 pt-8">
        <h2 className="mb-4 text-lg font-bold text-neutral-100">{t("discussion")}</h2>
        <Suspense fallback={<div className="h-40 w-full animate-pulse rounded-2xl border border-neutral-800" style={{ background: "var(--gcs-surface-3)" }} />}>
          <NewsDiscussion newsId={article.id} slug={slug} page={discussionPage} />
        </Suspense>
      </div>
    </div>
  );
}

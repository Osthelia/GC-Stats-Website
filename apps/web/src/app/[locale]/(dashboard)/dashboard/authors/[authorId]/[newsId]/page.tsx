/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLinkIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAuthorAdminAccess } from "@/lib/dashboard-rbac";
import { getDashboardNewsArticle, listDashboardNewsMessages } from "@/lib/dashboard-news-data";
import { sanitizeNewsContent } from "@/lib/news-content-sanitize";
import { parseEntityId } from "@/lib/entity-id";
import type { AppLocale } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormattedDate } from "@/components/formatted-date";
import { NewsConversationPanel } from "@/components/dashboard/news/news-conversation-panel";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.authors" });
  return { title: t("articleTitle") };
}

export default async function DashboardAuthorArticlePage({ params }: { params: Promise<{ locale: string; authorId: string; newsId: string }> }) {
  const { locale, authorId: rawAuthorId, newsId: rawNewsId } = await params;
  const authorId = parseEntityId(rawAuthorId);
  const newsId = parseEntityId(rawNewsId);
  if (authorId === null || newsId === null) notFound();

  await requireAuthorAdminAccess(locale as AppLocale);

  // Scoped to this author's individual articles, so an organization article can't be opened through this route.
  const article = await getDashboardNewsArticle({ authorId }, newsId);
  if (!article) notFound();

  const [messages, t, tNews, tEditor] = await Promise.all([
    listDashboardNewsMessages(article.id),
    getTranslations({ locale, namespace: "dashboard.authors" }),
    getTranslations({ locale, namespace: "dashboard.news" }),
    getTranslations({ locale, namespace: "dashboard.news.editor" }),
  ]);

  const hasRelations = article.teams.length > 0 || article.people.length > 0 || article.tournaments.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" render={<Link href={`/dashboard/authors/${authorId}`} />}>
          <ArrowLeft className="size-4" />
          {t("backToAuthor")}
        </Button>
        <Button variant="outline" size="sm" render={<Link href={`/news/${article.slug}`} target="_blank" rel="noopener noreferrer" />}>
          <ExternalLinkIcon className="size-4" />
          {tNews("viewPublicButton")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <p className="text-sm text-muted-foreground">{t("readOnlyNotice")}</p>
              <h2 className="text-xl font-semibold">{article.title}</h2>
              {article.excerpt && <p className="text-sm text-muted-foreground">{article.excerpt}</p>}
              <div className="news-content" dangerouslySetInnerHTML={{ __html: sanitizeNewsContent(article.content) }} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tEditor("sectionConversation")}</CardTitle>
            </CardHeader>
            <CardContent>
              <NewsConversationPanel organizationId={null} newsId={article.id} messages={messages} readOnly />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{tEditor("sectionStatus")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{tNews("columnStatus")}</span>
                <Badge variant={article.status === "published" && !article.isScheduled ? "default" : article.status === "archived" ? "secondary" : "outline"}>
                  {article.isScheduled ? tNews("status.scheduled") : tNews(`status.${article.status}`)}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{tEditor("fieldLang")}</span>
                <span className="font-mono text-xs uppercase">{article.lang}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{tEditor("fieldSlug")}</span>
                <span className="truncate font-mono text-xs">{article.slug}</span>
              </div>
              {article.publishedAt && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{t("publishedAt")}</span>
                  <FormattedDate date={article.publishedAt} mode="datetime" />
                </div>
              )}
            </CardContent>
          </Card>

          {hasRelations && (
            <Card>
              <CardHeader>
                <CardTitle>{tEditor("sectionRelations")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                {(
                  [
                    ["relationsTeams", article.teams],
                    ["relationsPeople", article.people],
                    ["relationsTournaments", article.tournaments],
                  ] as const
                ).map(
                  ([labelKey, entries]) =>
                    entries.length > 0 && (
                      <div key={labelKey} className="flex flex-col gap-1.5">
                        <span className="text-muted-foreground">{tEditor(labelKey)}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {entries.map((entry) => (
                            <Badge key={entry.id} variant="secondary">
                              {entry.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

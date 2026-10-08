/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAuthorAdminAccess } from "@/lib/dashboard-rbac";
import { getDashboardAuthor } from "@/lib/dashboard-authors-data";
import { listDashboardNewsArticles } from "@/lib/dashboard-news-data";
import { parseEntityId } from "@/lib/entity-id";
import type { AppLocale } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OrgLogoTile } from "@/components/dashboard/org-logo";
import { NewsListTable } from "@/components/dashboard/news/news-list-table";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.authors" });
  return { title: t("profileTitle") };
}

export default async function DashboardAuthorDetailPage({ params }: { params: Promise<{ locale: string; authorId: string }> }) {
  const { locale, authorId: rawAuthorId } = await params;
  const authorId = parseEntityId(rawAuthorId);
  if (authorId === null) notFound();

  await requireAuthorAdminAccess(locale as AppLocale);

  const [author, articles, t] = await Promise.all([
    getDashboardAuthor(authorId),
    listDashboardNewsArticles({ authorId }),
    getTranslations({ locale, namespace: "dashboard.authors" }),
  ]);
  if (!author) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/dashboard/authors" />}>
          <ArrowLeft className="size-4" />
          {t("backToList")}
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex items-center gap-4">
            <OrgLogoTile name={author.name} logoUrl={author.logoUrl} darkLogoUrl={author.darkLogoUrl} className="size-16 text-2xl" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-semibold">{author.name}</h2>
              <p className="truncate font-mono text-xs text-muted-foreground">{author.slug}</p>
            </div>
            <Badge variant={author.isAuthor ? "default" : "outline"}>{author.isAuthor ? t("accessGranted") : t("accessNone")}</Badge>
          </div>

          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">{t("columnAccount")}</dt>
              <dd className="font-medium">{author.username ? `@${author.username}` : t("noAccount")}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("columnIndividual")}</dt>
              <dd className="font-medium tabular-nums">{articles.length}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("columnOrganization")}</dt>
              <dd className="font-medium tabular-nums">{author.organizationCount}</dd>
            </div>
          </dl>

          <div className="text-sm">
            <div className="text-muted-foreground">{t("bio")}</div>
            <p className="whitespace-pre-wrap">{author.bio?.trim() ? author.bio : t("noBio")}</p>
          </div>
        </CardContent>
      </Card>

      <NewsListTable
        articles={articles}
        listHref={`/dashboard/authors/${author.id}`}
        canCreate={false}
        canEdit={false}
        publicHref={author.username ? `/user/${author.username}/news` : undefined}
      />
    </div>
  );
}

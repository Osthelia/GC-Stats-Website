/**
 * GC-Stats - news-editor-form
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/admin/form-field";
import {
  createDashboardNewsArticle,
  updateDashboardNewsArticle,
  syncDashboardNewsRelations,
  searchDashboardNewsAuthors,
  uploadDashboardNewsImage,
  type NewsArticleFieldErrors,
} from "@/actions/dashboard-news";
import { NewsRichTextEditor } from "@/components/dashboard/news/news-rich-text-editor";
import { NewsRelationsPicker, type NewsRelationsValue } from "@/components/dashboard/news/news-relations-picker";
import { EntitySinglePicker } from "@/components/dashboard/news/entity-single-picker";
import { NewsCoverPanel } from "@/components/dashboard/news/news-cover-panel";
import { NewsStatusActions } from "@/components/dashboard/news/news-status-actions";
import { NewsConversationPanel } from "@/components/dashboard/news/news-conversation-panel";
import type { DashboardNewsArticleDetail, DashboardNewsMessage } from "@/lib/dashboard-news-data";
import type { EntityOption } from "@/components/dashboard/news/entity-multi-picker";

export function NewsEditorForm({
  organizationId,
  article,
  messages,
  languages,
  canEdit,
  canEditPublished = false,
  canReview = false,
  canPublish,
  canDelete,
  listHref,
}: {
  organizationId: number | null;
  article: DashboardNewsArticleDetail | null;
  messages: DashboardNewsMessage[];
  languages: { code: string; name: string }[];
  canEdit: boolean;
  canEditPublished?: boolean;
  canReview?: boolean;
  canPublish: boolean;
  canDelete: boolean;
  listHref: string;
}) {
  const t = useTranslations("dashboard.news.editor");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<NewsArticleFieldErrors>({});

  const [title, setTitle] = useState(article?.title ?? "");
  const [slug, setSlug] = useState(article?.slug ?? "");
  const [lang, setLang] = useState(article?.lang ?? languages[0]?.code ?? "");
  const [excerpt, setExcerpt] = useState(article?.excerpt ?? "");
  const [content, setContent] = useState(article?.content ?? "");
  const [author, setAuthor] = useState<EntityOption | null>(article ? { id: article.authorId, label: article.authorName } : null);
  const [relations, setRelations] = useState<NewsRelationsValue>({ teams: article?.teams ?? [], people: article?.people ?? [], tournaments: article?.tournaments ?? [] });
  const [images, setImages] = useState(article?.images ?? []);
  const [coverUrl, setCoverUrl] = useState(article?.imageCover ?? null);

  const langItems = Object.fromEntries(languages.map((l) => [l.code, l.name]));
  const err = (field: keyof NewsArticleFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}`) : undefined);

  const isUnderReview = !!article && (article.status === "in_review" || article.status === "approved");
  const isPublished = !!article && article.status === "published";
  const contentLocked = isUnderReview || (isPublished && !canEditPublished);
  // Draft/changes_requested requires newsEdit, an already published article requires newsEditPublished instead.
  const editable = !contentLocked && (isPublished ? canEditPublished : canEdit);

  function handleSubmit() {
    setFieldErrors({});
    const input = { title, slug, lang, excerpt, content, authorId: author?.id ?? null };

    startTransition(async () => {
      if (!article) {
        const result = await createDashboardNewsArticle(organizationId, input);
        if (!result.ok) {
          setFieldErrors(result.fieldErrors);
          return;
        }
        toast.success(t("createSuccess"));
        router.push(`${listHref}/${result.id}`);
        return;
      }

      const result = await updateDashboardNewsArticle(organizationId, article.id, input);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        if (result.error) toast.error(t(`error.${result.error}`));
        return;
      }
      const relationsResult = await syncDashboardNewsRelations(organizationId, article.id, {
        teamIds: relations.teams.map((r) => r.id),
        personIds: relations.people.map((r) => r.id),
        tournamentIds: relations.tournaments.map((r) => r.id),
      });
      if (!relationsResult.ok) {
        toast.error(t("saveRelationsError"));
        router.refresh();
        return;
      }
      toast.success(t("saveSuccess"));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              {contentLocked && <p className="text-sm text-muted-foreground">{t("error.locked")}</p>}

              <FormField label={t("fieldTitle")} htmlFor="news-title" required error={err("title")}>
                <Input id="news-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!editable} aria-invalid={!!fieldErrors.title} />
              </FormField>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label={t("fieldSlug")} htmlFor="news-slug" hint={t("fieldSlugHint")} error={err("slug")}>
                  <Input id="news-slug" value={slug} onChange={(e) => setSlug(e.target.value)} disabled={!editable} aria-invalid={!!fieldErrors.slug} />
                </FormField>

                <FormField label={t("fieldLang")} htmlFor="news-lang" required error={err("lang")}>
                  <Select items={langItems} value={lang} onValueChange={(v) => setLang(v ?? "")} disabled={!editable}>
                    <SelectTrigger id="news-lang" className="w-full" aria-invalid={!!fieldErrors.lang}>
                      <SelectValue placeholder={t("fieldLangPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map((l) => (
                        <SelectItem key={l.code} value={l.code}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>

              {organizationId !== null && (
                <FormField label={t("fieldAuthor")} htmlFor="news-author" hint={t("fieldAuthorHint")} error={err("authorId")}>
                  <EntitySinglePicker
                    value={author}
                    onChange={editable ? setAuthor : () => {}}
                    search={(q) => searchDashboardNewsAuthors(organizationId, q).then((rows) => rows.map((r) => ({ id: r.id, label: r.name })))}
                    placeholder={t("fieldAuthorPlaceholder")}
                    searchPlaceholder={t("relationsSearchPlaceholder")}
                    noResultsLabel={t("relationsNoResults")}
                    clearLabel={t("relationsRemove")}
                  />
                </FormField>
              )}

              <FormField label={t("fieldExcerpt")} htmlFor="news-excerpt" hint={t("fieldExcerptHint")} error={err("excerpt")}>
                <Textarea id="news-excerpt" rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} disabled={!editable} aria-invalid={!!fieldErrors.excerpt} />
              </FormField>

              <FormField label={t("fieldContent")} htmlFor="news-content" required error={err("content")}>
                <NewsRichTextEditor
                  content={content}
                  onChange={setContent}
                  disabled={!editable}
                  onUploadImage={
                    article && editable
                      ? async (file) => {
                          const formData = new FormData();
                          formData.append("file", file);
                          const result = await uploadDashboardNewsImage(organizationId, article.id, formData);
                          if (!result.ok) {
                            toast.error(t(`error.${result.error}`));
                            return null;
                          }
                          setImages((prev) => [...prev, { id: result.id, url: result.url }]);
                          return result.url;
                        }
                      : undefined
                  }
                />
              </FormField>
            </CardContent>
          </Card>

          {article && editable && (
            <Card>
              <CardHeader>
                <CardTitle>{t("sectionCover")}</CardTitle>
              </CardHeader>
              <CardContent>
                <NewsCoverPanel
                  organizationId={organizationId}
                  newsId={article.id}
                  images={images}
                  coverUrl={coverUrl}
                  onImagesChange={setImages}
                  onCoverChange={setCoverUrl}
                />
              </CardContent>
            </Card>
          )}

          {article && (
            <Card>
              <CardHeader>
                <CardTitle>{t("sectionConversation")}</CardTitle>
              </CardHeader>
              <CardContent>
                <NewsConversationPanel organizationId={organizationId} newsId={article.id} messages={messages} />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {article && (
            <Card>
              <CardHeader>
                <CardTitle>{t("sectionStatus")}</CardTitle>
              </CardHeader>
              <CardContent>
                <NewsStatusActions
                  organizationId={organizationId}
                  article={article}
                  canEdit={canEdit}
                  canReview={canReview}
                  canPublish={canPublish}
                  canDelete={canDelete}
                  listHref={listHref}
                />
              </CardContent>
            </Card>
          )}

          {article && (canEdit || canEditPublished) && (
            <Card>
              <CardHeader>
                <CardTitle>{t("sectionRelations")}</CardTitle>
              </CardHeader>
              <CardContent>
                <NewsRelationsPicker organizationId={organizationId} value={relations} onChange={setRelations} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {editable && (
        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? t("saving") : article ? t("saveSubmit") : t("createSubmit")}
          </Button>
        </div>
      )}
    </div>
  );
}

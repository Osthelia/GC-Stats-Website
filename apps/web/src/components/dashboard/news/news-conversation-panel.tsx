/**
 * GC-Stats - news-conversation-panel
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormattedDate } from "@/components/formatted-date";
import { postDashboardNewsMessage } from "@/actions/dashboard-news";
import type { DashboardNewsMessage } from "@/lib/dashboard-news-data";

const SYSTEM_TYPES = ["submitted", "approved", "changes_requested", "published", "scheduled", "unpublished"] as const;

/** Private conversation attached to one article, never shown on the public site, only to whoever can reach this editor. Also doubles as the review timeline: submit/approve/request-changes/publish each drop a system row here alongside free-text comments. */
export function NewsConversationPanel({
  organizationId,
  newsId,
  messages,
  readOnly = false,
}: {
  organizationId: number | null;
  newsId: number;
  messages: DashboardNewsMessage[];
  /** Admin browsing someone else's article: shows the timeline without the reply box. */
  readOnly?: boolean;
}) {
  const t = useTranslations("dashboard.news.conversation");
  const router = useRouter();
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  function handlePost() {
    const trimmed = body.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const result = await postDashboardNewsMessage(organizationId, newsId, trimmed);
      if (!result.ok) {
        toast.error(t(`error.${result.error}`));
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}

      <div className="flex flex-col gap-3">
        {messages.map((m) =>
          (SYSTEM_TYPES as readonly string[]).includes(m.type) ? (
            <div key={m.id} className="flex flex-col gap-1 border-l-2 border-muted pl-3 text-sm text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">{m.authorName ?? t("unknownUser")}</span> {t(`event.${m.type}`)}
                {(m.type === "published" || m.type === "scheduled") && (
                  <>
                    {" "}
                    <FormattedDate date={m.body} mode="datetime" />
                  </>
                )}
                {" · "}
                <FormattedDate date={m.createdAt} mode="datetime" />
              </div>
              {m.type === "changes_requested" && m.body && <p className="rounded-md bg-muted/50 px-2.5 py-1.5 text-foreground">{m.body}</p>}
            </div>
          ) : (
            <div key={m.id} className="flex flex-col gap-1 rounded-lg border bg-card px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{m.authorName ?? t("unknownUser")}</span>
                <FormattedDate date={m.createdAt} mode="datetime" />
              </div>
              <p className="whitespace-pre-wrap">{m.body}</p>
            </div>
          )
        )}
      </div>

      {!readOnly && (
        <div className="flex flex-col gap-2 border-t pt-3">
          <Textarea rows={3} placeholder={t("placeholder")} value={body} onChange={(e) => setBody(e.target.value)} />
          <Button size="sm" className="self-end" disabled={isPending || !body.trim()} onClick={handlePost}>
            {t("postButton")}
          </Button>
        </div>
      )}
    </div>
  );
}

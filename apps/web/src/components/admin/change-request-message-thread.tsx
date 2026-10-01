/**
 * GC-Stats - change-request-message-thread
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { postChangeRequestMessage } from "@/actions/change-requests";
import type { ChangeRequestMessageRow } from "@/lib/change-request-messages";

/** Net-new admin-side reader/writer for change_request_messages — see components/settings/change-request-message-thread.tsx for the public counterpart (kept separate per CLAUDE.md, not shared). */
export function AdminChangeRequestMessageThread({ changeRequestId, messages, canPost }: { changeRequestId: number; messages: ChangeRequestMessageRow[]; canPost: boolean }) {
  const t = useTranslations("admin.changeRequests.detail.thread");
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    const result = await postChangeRequestMessage(changeRequestId, body);
    setPending(false);
    if (!result.ok) {
      toast.error(t("error"));
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">{t("heading")}</h2>

      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto">
          {messages.map((message) => (
            <div key={message.id} className="rounded-lg border bg-muted/40 p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">{message.username ?? t("deletedAccount")}</p>
              <p className="whitespace-pre-wrap text-sm">{message.body}</p>
            </div>
          ))}
        </div>
      )}

      {canPost && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={1} className="min-h-9 flex-1" placeholder={t("replyPlaceholder")} />
          <Button type="submit" size="sm" disabled={pending}>
            {t("send")}
          </Button>
        </form>
      )}
    </div>
  );
}

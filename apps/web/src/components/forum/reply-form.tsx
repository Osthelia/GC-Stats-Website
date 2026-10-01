/**
 * GC-Stats - reply-form
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { postForumMessage } from "@/actions/forum";
import { EmoteInsertButton } from "@/components/forum/emote-insert-button";
import { MentionTextarea, type MentionTextareaHandle } from "@/components/forum/mention-textarea";
import { useForumReply } from "@/components/forum/forum-reply-context";
import type { PickerEmote } from "@/lib/reactions";

export function ReplyForm({ threadId, pickerEmotes }: { threadId: number; pickerEmotes: PickerEmote[] }) {
  const t = useTranslations("forum.reply");
  const tMessage = useTranslations("forum.message");
  const router = useRouter();
  const { replyTarget, setReplyTarget } = useForumReply();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const textareaRef = useRef<MentionTextareaHandle>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const result = await postForumMessage({ threadId, body, parentId: replyTarget?.id ?? null });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setBody("");
    setReplyTarget(null);
    router.refresh();
  }

  return (
    <form id="forum-reply-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-3 rounded-2xl border border-neutral-800 bg-[var(--gcs-surface)] p-5">
      {replyTarget && (
        <div className="flex items-start gap-2 rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-3.5 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium text-[#e4ae22]">{tMessage("replyingTo", { username: replyTarget.authorUsername ?? tMessage("deletedAccount") })}</p>
            <p className="truncate text-[13px] text-neutral-400">{replyTarget.preview}</p>
          </div>
          <button
            type="button"
            onClick={() => setReplyTarget(null)}
            aria-label={t("cancelReply")}
            className="flex size-6 flex-none items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <label className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-[13px] text-neutral-400">
            {t("bodyLabel")}
            <span className="text-[#e08585]">*</span>
          </span>
          <EmoteInsertButton emotes={pickerEmotes} onInsert={(name) => textareaRef.current?.insertAtCursor(`:${name}:`)} />
        </div>
        <MentionTextarea ref={textareaRef} value={body} onChange={setBody} rows={4} maxLength={3000} invalid={error === "bodyRequired" || error === "bodyTooLong"} />
      </label>

      {error && (
        <p role="alert" className="text-[13.5px] text-[#e08585]">
          {t(`error.${error}`)}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-[9px] bg-[#e4ae22] px-5 py-2.5 text-[14px] font-semibold text-[#0e0e0e] transition-colors hover:bg-[#c9981d] active:bg-[#b3860f] disabled:opacity-60"
      >
        {pending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}

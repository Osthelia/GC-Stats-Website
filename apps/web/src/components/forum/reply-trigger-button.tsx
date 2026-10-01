/**
 * GC-Stats - reply-trigger-button
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import { CornerUpLeft } from "lucide-react";
import { useForumReply } from "@/components/forum/forum-reply-context";

const PREVIEW_LENGTH = 140;

export function ReplyTriggerButton({ messageId, authorUsername, body, canReply }: { messageId: number; authorUsername: string | null; body: string; canReply: boolean }) {
  const t = useTranslations("forum.message");
  const { setReplyTarget } = useForumReply();

  if (!canReply) return null;

  return (
    <button
      type="button"
      onClick={() => {
        setReplyTarget({ id: messageId, authorUsername, preview: body.length > PREVIEW_LENGTH ? `${body.slice(0, PREVIEW_LENGTH)}…` : body });
        document.getElementById("forum-reply-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }}
      className="flex items-center gap-1 text-[12px] font-medium text-neutral-500 transition-colors hover:text-[#e4ae22]"
    >
      <CornerUpLeft className="size-3.5" />
      {t("reply")}
    </button>
  );
}

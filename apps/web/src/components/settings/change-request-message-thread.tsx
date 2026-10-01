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
import { useRouter } from "@/i18n/navigation";
import { postChangeRequestMessage } from "@/actions/change-requests";
import type { ChangeRequestMessageRow } from "@/lib/change-request-messages";

const inputClass =
  "w-full rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-3.5 py-2.5 text-[14.5px] text-neutral-50 outline-none transition-colors focus:border-[#e4ae22]/60";

export function ChangeRequestMessageThread({ changeRequestId, messages, canPost, currentUserId }: { changeRequestId: number; messages: ChangeRequestMessageRow[]; canPost: boolean; currentUserId: string }) {
  const t = useTranslations("accountSettings.changeRequests.detail.thread");
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const result = await postChangeRequestMessage(changeRequestId, body);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-[15px] font-semibold text-neutral-50">{t("heading")}</h2>

      {messages.length === 0 ? (
        <p className="text-[13px] text-neutral-500">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {messages.map((message) => (
            <div
              key={message.id}
              className="rounded-xl border border-neutral-800/70 p-3.5"
              style={{ background: message.userId === currentUserId ? "var(--gcs-hover)" : "var(--gcs-surface-3)" }}
            >
              <p className="mb-1 text-[12.5px] font-semibold text-neutral-300">{message.username ?? t("deletedAccount")}</p>
              <p className="whitespace-pre-wrap text-[13.5px] text-neutral-100">{message.body}</p>
            </div>
          ))}
        </div>
      )}

      {canPost ? (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1 text-[13px] text-neutral-400">
              {t("replyLabel")}
              <span className="text-[#e08585]">*</span>
            </span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={2000} aria-invalid={!!error} className={inputClass} />
          </label>
          {error && (
            <p role="alert" className="text-[13px] text-[#e08585]">
              {t(`error.${error}`)}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="self-start rounded-[9px] bg-[#e4ae22] px-5 py-2.5 text-[14px] font-semibold text-[#0e0e0e] transition-colors hover:bg-[#c9981d] active:bg-[#b3860f] disabled:opacity-60"
          >
            {pending ? t("sending") : t("send")}
          </button>
        </form>
      ) : (
        <p className="text-[13px] text-neutral-500">{t("closed")}</p>
      )}
    </div>
  );
}

/**
 * GC-Stats - create-thread-form
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createGeneralThread } from "@/actions/forum";
import { EmoteInsertButton } from "@/components/forum/emote-insert-button";
import { MentionTextarea, type MentionTextareaHandle } from "@/components/forum/mention-textarea";
import type { PickerEmote } from "@/lib/reactions";

const inputClass =
  "w-full rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-3.5 py-2.5 text-[14.5px] text-neutral-50 outline-none transition-colors focus:border-[#e4ae22]/60 aria-[invalid=true]:border-[#e08585]";

export function CreateThreadForm({ pickerEmotes }: { pickerEmotes: PickerEmote[] }) {
  const t = useTranslations("forum.create");
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const bodyRef = useRef<MentionTextareaHandle>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const result = await createGeneralThread({ title, body });

    if (!result.ok) {
      setPending(false);
      setError(result.error);
      return;
    }

    router.push(`/forum/threads/${result.threadId}`);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 rounded-2xl border border-neutral-800 bg-[var(--gcs-surface)] p-6">
      <label className="flex flex-col gap-1.5">
        <span className="flex items-center gap-1 text-[13px] text-neutral-400">
          {t("titleLabel")}
          <span className="text-[#e08585]">*</span>
        </span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={150}
          aria-invalid={error === "titleRequired" || error === "titleTooLong"}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-[13px] text-neutral-400">
            {t("bodyLabel")}
            <span className="text-[#e08585]">*</span>
          </span>
          <EmoteInsertButton emotes={pickerEmotes} onInsert={(name) => bodyRef.current?.insertAtCursor(`:${name}:`)} />
        </div>
        <MentionTextarea ref={bodyRef} value={body} onChange={setBody} rows={8} maxLength={5000} invalid={error === "bodyRequired" || error === "bodyTooLong"} />
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

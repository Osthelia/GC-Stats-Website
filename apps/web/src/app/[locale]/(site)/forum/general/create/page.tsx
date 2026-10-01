/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { getForumPostStatus } from "@/lib/forum-guards";
import { getActiveEmotesForPicker } from "@/lib/reactions";
import { ForumPostGate } from "@/components/forum/forum-post-gate";
import { CreateThreadForm } from "@/components/forum/create-thread-form";

export default async function CreateForumThreadPage() {
  const t = await getTranslations("forum.create");
  const session = await auth();
  const [status, pickerEmotes] = await Promise.all([getForumPostStatus(session?.user?.id), getActiveEmotesForPicker()]);

  return (
    <div className="mx-auto max-w-[720px] px-6 py-10">
      <h1 className="mb-6 text-2xl font-black text-neutral-50">{t("title")}</h1>
      <ForumPostGate status={status}>
        <CreateThreadForm pickerEmotes={pickerEmotes} />
      </ForumPostGate>
    </div>
  );
}

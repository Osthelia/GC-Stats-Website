/**
 * GC-Stats - forum-message-item
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ForumAvatar } from "@/components/forum/forum-avatar";
import { ReportButton } from "@/components/forum/report-button";
import { ReplyTriggerButton } from "@/components/forum/reply-trigger-button";
import { FormattedDate } from "@/components/formatted-date";
import { ForumMessageBody } from "@/components/forum/forum-message-body";
import { ReactionBar } from "@/components/reactions/reaction-bar";
import { UserBadges } from "@/components/user/user-badges";
import type { ForumMessageView } from "@/lib/forum-data";
import type { PickerEmote } from "@/lib/reactions";

export async function ForumMessageItem({ message, canReport, canReply, pickerEmotes, isAuthenticated }: { message: ForumMessageView; canReport: boolean; canReply: boolean; pickerEmotes: PickerEmote[]; isAuthenticated: boolean }) {
  const t = await getTranslations("forum.message");

  return (
    <div id={`message-${message.id}`} className="flex scroll-mt-24 gap-3 rounded-2xl border border-neutral-800/70 bg-[var(--gcs-surface-3)] p-4">
      <ForumAvatar username={message.authorUsername} image={message.authorImage} />
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          {message.authorUsername ? (
            <Link href={`/user/${message.authorUsername}`} className="text-[13.5px] font-semibold text-neutral-100 transition-colors hover:text-[#e4ae22]">
              {message.authorUsername}
            </Link>
          ) : (
            <span className="text-[13.5px] font-semibold text-neutral-100">{t("deletedAccount")}</span>
          )}
          <UserBadges pronouns={message.authorPronouns} fanTeam={message.authorFanTeam} size="sm" />
          <span className="text-[11.5px] text-neutral-500">
            <FormattedDate date={message.createdAt} mode="datetime" />
          </span>
          <span className="ml-auto flex items-center gap-3">
            <ReplyTriggerButton messageId={message.id} authorUsername={message.authorUsername} body={message.body} canReply={canReply} />
            <ReportButton messageId={message.id} canReport={canReport} />
          </span>
        </div>

        {message.parentId && !message.parentAvailable && <p className="mb-2 text-[12.5px] text-neutral-600 italic">{t("parentUnavailable")}</p>}

        {message.parentId && message.parentAvailable && (
          <a
            href={`#message-${message.parentId}`}
            className="mb-2 flex flex-col gap-0.5 rounded-lg border border-neutral-800 bg-[var(--gcs-surface-2)] px-3 py-1.5 transition-colors hover:border-neutral-700"
          >
            <span className="text-[11.5px] font-medium text-[#e4ae22]">{t("replyingTo", { username: message.parentAuthorUsername ?? t("deletedAccount") })}</span>
            {message.parentPreview && <span className="truncate text-[12.5px] text-neutral-500">{message.parentPreview}</span>}
          </a>
        )}

        <ForumMessageBody body={message.body} emotes={pickerEmotes} />
        <ReactionBar reactableType="forum_message" reactableId={message.id} initialReactions={message.reactions} pickerEmotes={pickerEmotes} isAuthenticated={isAuthenticated} />
      </div>
    </div>
  );
}

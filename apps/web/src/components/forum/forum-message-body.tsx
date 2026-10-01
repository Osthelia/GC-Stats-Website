/**
 * GC-Stats - forum-message-body
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { Fragment } from "react";
import { Link } from "@/i18n/navigation";
import { EmoteImage } from "@/components/reactions/emote-image";
import type { PickerEmote } from "@/lib/reactions";

// Matches the `:name:` shortcode inserted by EmoteInsertButton, any name an
// active emote can have (no charset restriction on emotes.name beyond
// length, see admin-emotes.ts), just not whitespace or another colon.
const EMOTE_PATTERN = /:([^\s:]{1,80}):/g;

// Same charset as lib/user-profile-validation.ts USERNAME_RE — the mention
// inserted by MentionTextarea. Rendered as a link regardless of whether the
// account still exists (cosmetic highlight, mirrors the tolerant entity-id
// slug pattern elsewhere on the site).
const MENTION_PATTERN = /@([a-zA-Z0-9_-]{3,32})/g;

type BodyNode = { key: string; text?: string; emote?: PickerEmote; mention?: string };

/** Renders a forum message body, replacing `:name:` shortcodes with the matching active emote image and `@username` with a link to that profile. */
export function ForumMessageBody({ body, emotes }: { body: string; emotes: PickerEmote[] }) {
  const byName = new Map(emotes.map((e) => [e.name.toLowerCase(), e]));
  const nodes: BodyNode[] = [];
  let lastIndex = 0;

  const tokens = [...body.matchAll(EMOTE_PATTERN), ...body.matchAll(MENTION_PATTERN)].sort((a, b) => a.index! - b.index!);

  for (const match of tokens) {
    const index = match.index!;
    if (index < lastIndex) continue;
    const isMention = match[0].startsWith("@");
    const emote = isMention ? undefined : byName.get(match[1]!.toLowerCase());
    if (!isMention && !emote) continue;

    if (index > lastIndex) nodes.push({ key: `t${lastIndex}`, text: body.slice(lastIndex, index) });
    if (isMention) nodes.push({ key: `m${index}`, mention: match[1] });
    else nodes.push({ key: `e${index}`, emote });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < body.length) nodes.push({ key: `t${lastIndex}`, text: body.slice(lastIndex) });

  return (
    <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-neutral-300">
      {nodes.map((node) => {
        if (node.emote) return <EmoteImage key={node.key} src={node.emote.imagePath} alt={node.emote.name} className="inline-block h-[1.3em] w-[1.3em] align-text-bottom object-contain" />;
        if (node.mention)
          return (
            <Link key={node.key} href={`/user/${node.mention}`} className="font-medium text-[#e4ae22] transition-colors hover:text-[#f5c14e]">
              @{node.mention}
            </Link>
          );
        return <Fragment key={node.key}>{node.text}</Fragment>;
      })}
    </p>
  );
}

/**
 * GC-Stats - forum-reply-context
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type ReplyTarget = { id: number; authorUsername: string | null; preview: string };

type ForumReplyContextValue = {
  replyTarget: ReplyTarget | null;
  setReplyTarget: (target: ReplyTarget | null) => void;
};

const ForumReplyContext = createContext<ForumReplyContextValue | null>(null);

/** Shares the "replying to" target between each message's reply button and the single reply form at the bottom of the thread (see forum-thread-panel.tsx). */
export function ForumReplyProvider({ children }: { children: ReactNode }) {
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const value = useMemo(() => ({ replyTarget, setReplyTarget }), [replyTarget]);
  return <ForumReplyContext.Provider value={value}>{children}</ForumReplyContext.Provider>;
}

export function useForumReply(): ForumReplyContextValue {
  const ctx = useContext(ForumReplyContext);
  if (!ctx) throw new Error("useForumReply must be used within a ForumReplyProvider");
  return ctx;
}

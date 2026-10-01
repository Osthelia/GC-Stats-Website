/**
 * GC-Stats - notification-bell
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FormattedDate } from "@/components/formatted-date";
import { markAllNotificationsRead } from "@/actions/notifications";

const POLL_INTERVAL_MS = 30_000;

type NotificationSummaryRow = {
  id: number;
  type: string;
  data: Record<string, string | number>;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationBell() {
  const { status } = useSession();
  const t = useTranslations("notifications");
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recent, setRecent] = useState<NotificationSummaryRow[]>([]);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/summary");
      if (!res.ok) return;
      const payload = (await res.json()) as { unreadCount: number; recent: NotificationSummaryRow[] };
      setUnreadCount(payload.unreadCount);
      setRecent(payload.recent);
    } catch {
      // silent — the badge just stays stale until the next poll
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchSummary();
    const interval = setInterval(fetchSummary, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [status, fetchSummary]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function handleMarkAllRead() {
    setMarkingAllRead(true);
    const result = await markAllNotificationsRead();
    setMarkingAllRead(false);
    if (result.ok) {
      setUnreadCount(0);
      setRecent((rows) => rows.map((r) => ({ ...r, readAt: r.readAt ?? new Date().toISOString() })));
    }
  }

  if (status !== "authenticated") return null;

  return (
    <div ref={rootRef} className="relative flex-none">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t("bellTitle")}
        className="relative flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border transition-colors"
        style={{
          background: open ? "var(--gcs-hover)" : "var(--gcs-surface)",
          borderColor: open ? "var(--gcs-hover-2)" : "var(--gcs-border)",
          color: open ? "#e4ae22" : "var(--gcs-text-secondary)",
        }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#e4ae22] px-1 text-[10px] font-bold text-[#0e0e0e]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          role="menu"
          className="absolute right-0 top-[46px] z-[70] w-[340px] rounded-[14px] border border-neutral-800 bg-[var(--gcs-surface-3)] p-2 shadow-[0_22px_50px_rgba(0,0,0,.72)]"
        >
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-[13px] font-semibold text-neutral-50">{t("title")}</span>
            {unreadCount > 0 && (
              <button
                type="button"
                disabled={markingAllRead}
                onClick={handleMarkAllRead}
                className="text-[12px] font-medium text-[#e4ae22] transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                {t("markAllRead")}
              </button>
            )}
          </div>

          <div className="flex max-h-[380px] flex-col gap-0.5 overflow-y-auto">
            {recent.length === 0 && <p className="px-2 py-6 text-center text-[13px] text-[var(--gcs-text-tertiary)]">{t("empty")}</p>}
            {recent.map((row) => (
              <Link
                key={row.id}
                href={`/notifications/${row.id}/open`}
                onClick={() => setOpen(false)}
                className="flex flex-col gap-0.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-white/6"
              >
                <span className="flex items-start gap-1.5 text-[13px] font-semibold text-neutral-100">
                  {!row.readAt && <span aria-hidden="true" className="mt-1.5 h-[6px] w-[6px] flex-none rounded-full bg-[#e4ae22]" />}
                  {t(`type.${row.type}.title`, row.data)}
                </span>
                <span className="text-[12px] text-neutral-500">{t(`type.${row.type}.body`, row.data)}</span>
                <span className="text-[11px] text-neutral-600">
                  <FormattedDate date={row.createdAt} mode="datetime" />
                </span>
              </Link>
            ))}
          </div>

          <Link
            href="/settings/notifications"
            onClick={() => setOpen(false)}
            className="mt-1 block rounded-lg px-2.5 py-2 text-center text-[12.5px] font-medium text-neutral-400 transition-colors hover:bg-white/6 hover:text-neutral-50"
          >
            {t("viewAll")}
          </Link>
        </div>
      )}
    </div>
  );
}

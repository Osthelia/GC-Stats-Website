/**
 * GC-Stats - share-menu-button
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarPlusIcon, CheckIcon, Code2Icon, CopyIcon, LayersIcon, Share2Icon } from "lucide-react";
import { Link } from "@/i18n/navigation";

const ICONS = { match: Code2Icon, tournament: LayersIcon } as const;

export type ShareMenuItem = { href: string; label: string; icon: keyof typeof ICONS };

const ITEM_CLASS =
  "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs font-semibold text-neutral-300 transition-colors hover:bg-white/5 hover:text-neutral-50 active:bg-white/10";

/** "Share" button of the public entity headers, opening a small menu of links. `calendarPath` adds the match calendar feed entries. */
export function ShareMenuButton({ items = [], calendarPath }: { items?: ShareMenuItem[]; calendarPath?: string }) {
  const t = useTranslations("share");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  // Only rendered once the menu is open, so always client side.
  const calendarUrl = () => `${window.location.origin}${calendarPath}?lang=${locale}`;
  const webcalUrl = () => calendarUrl().replace(/^https?:/, "webcal:");

  const copyCalendar = async () => {
    try {
      await navigator.clipboard.writeText(calendarUrl());
      setCopied(true);
    } catch {
      // Clipboard blocked (insecure context): show the feed so it can be copied by hand.
      window.open(calendarUrl(), "_blank", "noopener");
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-neutral-300 transition-all duration-200 hover:-translate-y-0.5 hover:border-neutral-500 hover:text-neutral-50 active:scale-[0.97]"
      >
        <Share2Icon className="h-3.5 w-3.5" />
        {t("button")}
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-neutral-800 p-1.5 shadow-xl" style={{ background: "var(--gcs-surface-2)" }}>
          {items.map((item) => {
            const Icon = ICONS[item.icon];
            return (
              <Link
                key={item.href}
                role="menuitem"
                href={item.href}
                onClick={() => setOpen(false)}
                className={ITEM_CLASS}
              >
                <Icon className="h-3.5 w-3.5 flex-none text-neutral-500" />
                {item.label}
              </Link>
            );
          })}
          {calendarPath && (
            <>
              {items.length > 0 && <div className="my-1 border-t border-neutral-800" />}
              <p className="px-3 pt-1.5 pb-1 font-mono text-[10px] font-bold tracking-widest text-neutral-500 uppercase">{t("calendarTitle")}</p>
              <a role="menuitem" href={webcalUrl()} onClick={() => setOpen(false)} className={ITEM_CLASS}>
                <CalendarPlusIcon className="h-3.5 w-3.5 flex-none text-neutral-500" />
                {t("calendarSubscribe")}
              </a>
              <a
                role="menuitem"
                href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl())}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className={ITEM_CLASS}
              >
                <CalendarPlusIcon className="h-3.5 w-3.5 flex-none text-neutral-500" />
                {t("calendarGoogle")}
              </a>
              <button type="button" role="menuitem" onClick={copyCalendar} className={ITEM_CLASS}>
                {copied ? <CheckIcon className="h-3.5 w-3.5 flex-none text-emerald-400" /> : <CopyIcon className="h-3.5 w-3.5 flex-none text-neutral-500" />}
                {copied ? t("calendarCopied") : t("calendarCopy")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

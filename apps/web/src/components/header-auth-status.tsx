/**
 * GC-Stats - header-auth-status
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useSession, signOut } from "next-auth/react";
import { Link } from "@/i18n/navigation";

export function HeaderAuthStatus({ isAdmin = false, isDashboard = false, compact = false }: { isAdmin?: boolean; isDashboard?: boolean; compact?: boolean }) {
  const t = useTranslations("nav");
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
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

  if (status === "loading") {
    return <div aria-hidden="true" className="h-[38px] w-[38px] flex-none animate-pulse rounded-full bg-[var(--gcs-surface)]" />;
  }

  if (status === "authenticated") {
    const user = session.user;
    const label = user?.name ?? user?.email ?? "";

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
          className="flex items-center gap-2 whitespace-nowrap rounded-[10px] py-1 pl-1 pr-2 text-sm text-neutral-300 transition-colors hover:text-neutral-50"
        >
          {user?.image ? (
            // Arbitrary host (OAuth provider avatar) — plain <img>, not next/image.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" className="h-7 w-7 flex-none rounded-full object-cover" />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#e4ae22]/15 text-[12px] font-bold text-[#e4ae22]"
            >
              {label.charAt(0).toUpperCase() || "?"}
            </span>
          )}
          {!compact && <span className="max-w-[120px] truncate">{label}</span>}
          {!compact && (
            <span aria-hidden="true" className="flex-none text-[10px] text-neutral-500">
              ▾
            </span>
          )}
        </button>

        {open && (
          <div
            role="menu"
            aria-label={label}
            className="absolute right-0 top-[46px] z-[70] flex min-w-[190px] flex-col gap-0.5 rounded-[10px] border border-neutral-800 bg-[var(--gcs-surface-3)] p-1.5 shadow-[0_20px_48px_rgba(0,0,0,.7)]"
          >
            {isAdmin && (
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex w-full items-center rounded-[7px] px-2.5 py-2.5 text-left text-sm text-neutral-100 transition-colors hover:bg-white/6"
              >
                {t("adminPanel")}
              </Link>
            )}
            {isDashboard && (
              <Link
                href="/dashboard"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex w-full items-center rounded-[7px] px-2.5 py-2.5 text-left text-sm text-neutral-100 transition-colors hover:bg-white/6"
              >
                {t("dashboardPanel")}
              </Link>
            )}
            {user?.username && (
              <Link
                href={`/user/${user.username}`}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex w-full items-center rounded-[7px] px-2.5 py-2.5 text-left text-sm text-neutral-100 transition-colors hover:bg-white/6"
              >
                {t("myProfile")}
              </Link>
            )}
            <Link
              href="/settings/account"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-center rounded-[7px] px-2.5 py-2.5 text-left text-sm text-neutral-100 transition-colors hover:bg-white/6"
            >
              {t("myAccount")}
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex w-full items-center rounded-[7px] px-2.5 py-2.5 text-left text-sm text-neutral-100 transition-colors hover:bg-white/6"
            >
              {t("logout")}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-none items-center gap-2.5 whitespace-nowrap">
      {!compact && (
        <Link href="/login" className="text-sm text-neutral-300 transition-colors hover:text-neutral-50">
          {t("login")}
        </Link>
      )}
      <Link
        href="/register"
        className={
          compact
            ? "flex h-[38px] flex-none items-center whitespace-nowrap rounded-[10px] bg-[#e4ae22] px-3 text-sm font-semibold text-[#0e0e0e] transition-shadow hover:bg-[#c9981d]"
            : "flex h-[38px] flex-none items-center whitespace-nowrap rounded-[10px] bg-[#e4ae22] px-4 text-sm font-semibold text-[#0e0e0e] transition-shadow hover:bg-[#c9981d] hover:shadow-[0_0_0_4px_rgba(228,174,34,.14)]"
        }
      >
        {t("register")}
      </Link>
    </div>
  );
}

/**
 * GC-Stats - org-switcher
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Newspaper, KeySquare, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { DASHBOARD_AUTHOR_ADMIN_HREF, isDashboardPathIn } from "@/lib/dashboard-nav-items";
import { OrgLogoTile } from "@/components/dashboard/org-logo";

export type DashboardOrgSwitcherItem = { organizationId: number; organizationName: string; logoUrl: string | null; darkLogoUrl: string | null; isGlobalAdminOverride: boolean };

/** Header org switcher, replaces the old sidebar "Vos organisations" list. Reads the active organization from the URL, same pattern as DashboardSidebar. `isAuthor`/`hasApiKey` each add a fixed individual-space entry so a member with several kinds of access can jump between them from anywhere. */
export function OrgSwitcher({
  organizations,
  isAuthor = false,
  hasApiKey = false,
  isAuthorAdmin = false,
}: {
  organizations: DashboardOrgSwitcherItem[];
  isAuthor?: boolean;
  hasApiKey?: boolean;
  isAuthorAdmin?: boolean;
}) {
  const t = useTranslations("dashboard.switcher");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const isAuthorAdminSpace = isDashboardPathIn(pathname, DASHBOARD_AUTHOR_ADMIN_HREF);
  const isAuthorSpace = isDashboardPathIn(pathname, "/dashboard/author");
  const isApiKeySpace = isDashboardPathIn(pathname, "/dashboard/api-keys");
  const orgMatch = /^\/dashboard\/(\d+)/.exec(pathname);
  const activeId = orgMatch ? Number(orgMatch[1]) : null;
  const active = organizations.find((o) => o.organizationId === activeId) ?? null;

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

  if (organizations.length === 0 && !isAuthor && !hasApiKey && !isAuthorAdmin) return null;

  const label = isAuthorAdminSpace
    ? t("authorAdminSpace")
    : isAuthorSpace
      ? t("authorSpace")
      : isApiKeySpace
        ? t("apiKeySpace")
        : active
          ? active.organizationName
          : t("selectOrganization");

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      >
        {isAuthorAdminSpace ? (
          <UsersRound className="size-5 rounded-md text-muted-foreground" />
        ) : isAuthorSpace ? (
          <Newspaper className="size-5 rounded-md text-muted-foreground" />
        ) : isApiKeySpace ? (
          <KeySquare className="size-5 rounded-md text-muted-foreground" />
        ) : (
          <OrgLogoTile name={active?.organizationName ?? null} logoUrl={active?.logoUrl ?? null} darkLogoUrl={active?.darkLogoUrl ?? null} className="size-5 rounded-md" />
        )}
        <span className="max-w-40 truncate">{label}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t("selectOrganization")}
          className="absolute right-0 top-[calc(100%+6px)] z-50 flex max-h-80 w-64 flex-col gap-0.5 overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          {isAuthorAdmin && (
            <Link
              href={DASHBOARD_AUTHOR_ADMIN_HREF}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <UsersRound className="size-6 rounded-md p-1 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{t("authorAdminSpace")}</span>
              {isAuthorAdminSpace && <Check className="size-3.5 shrink-0 text-primary" />}
            </Link>
          )}
          {isAuthor && (
            <Link
              href="/dashboard/author"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Newspaper className="size-6 rounded-md p-1 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{t("authorSpace")}</span>
              {isAuthorSpace && <Check className="size-3.5 shrink-0 text-primary" />}
            </Link>
          )}
          {hasApiKey && (
            <Link
              href="/dashboard/api-keys"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <KeySquare className="size-6 rounded-md p-1 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{t("apiKeySpace")}</span>
              {isApiKeySpace && <Check className="size-3.5 shrink-0 text-primary" />}
            </Link>
          )}
          {(isAuthorAdmin || isAuthor || hasApiKey) && organizations.length > 0 && <div className="my-1 border-t" />}
          {organizations.map((org) => (
            <Link
              key={org.organizationId}
              href={`/dashboard/${org.organizationId}`}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <OrgLogoTile name={org.organizationName} logoUrl={org.logoUrl} darkLogoUrl={org.darkLogoUrl} className="size-6 rounded-md" />
              <span className="min-w-0 flex-1 truncate">{org.organizationName}</span>
              {org.isGlobalAdminOverride && (
                <span className="flex-none rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">{t("adminAccess")}</span>
              )}
              {org.organizationId === activeId && <Check className="size-3.5 shrink-0 text-primary" />}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

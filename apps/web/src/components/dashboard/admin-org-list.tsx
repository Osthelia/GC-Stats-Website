/**
 * GC-Stats - admin-org-list
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { OrgLogoTile } from "@/components/dashboard/org-logo";
import { ORGANIZATION_TAGS, organizationTagStyle } from "@/lib/organization-tags";
import { cn } from "@/lib/utils";

export type AdminOrgListItem = { organizationId: number; organizationName: string; logoUrl: string | null; darkLogoUrl: string | null; tags: string[] };

/** "All organizations" section of the /dashboard picker (site admin): name search plus tag chips, filtered client side since the full list is already loaded. */
export function AdminOrgList({ organizations }: { organizations: AdminOrgListItem[] }) {
  const t = useTranslations("dashboard.picker");
  const tTags = useTranslations("admin.organizations.tagOptions");
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return organizations.filter((o) => (!q || o.organizationName.toLowerCase().includes(q)) && (!activeTag || o.tags.includes(activeTag)));
  }, [organizations, query, activeTag]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchPlaceholder")} aria-label={t("searchPlaceholder")} className="pl-8" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[null, ...ORGANIZATION_TAGS].map((tag) => {
          const selected = activeTag === tag;
          return (
            <button
              key={tag ?? "all"}
              type="button"
              aria-pressed={selected}
              onClick={() => setActiveTag(tag)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring active:scale-95",
                selected ? (tag ? organizationTagStyle(tag) : "border-primary/40 bg-primary/10 text-primary") : "bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {tag ? tTags(tag) : t("filterTagAll")}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t("noResults")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((o) => (
            <Link
              key={o.organizationId}
              href={`/dashboard/${o.organizationId}`}
              className="flex items-center gap-3 rounded-lg border border-dashed bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:translate-y-0 active:scale-[0.98]"
            >
              <OrgLogoTile name={o.organizationName} logoUrl={o.logoUrl} darkLogoUrl={o.darkLogoUrl} className="size-10" />
              <span className="min-w-0 flex-1 truncate font-medium">{o.organizationName}</span>
              <span className="flex-none rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">{t("adminBadge")}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

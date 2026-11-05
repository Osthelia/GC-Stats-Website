/**
 * GC-Stats - api-keys-tabs
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { Handshake, KeyRound } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "partner", href: "/admin/api-keys", icon: Handshake },
  { key: "public", href: "/admin/api-keys/public", icon: KeyRound },
] as const;

/** Switches between the partner and the public API keys pages. */
export async function ApiKeysTabs({ active }: { active: (typeof TABS)[number]["key"] }) {
  const t = await getTranslations("admin.apiKeys.tabs");
  return (
    <nav className="flex w-fit gap-1 rounded-lg border bg-muted/40 p-1">
      {TABS.map(({ key, href, icon: Icon }) => (
        <Link
          key={key}
          href={href}
          aria-current={key === active ? "page" : undefined}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all active:scale-[0.97]",
            key === active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
          )}
        >
          <Icon className="size-4" />
          {t(key)}
        </Link>
      ))}
    </nav>
  );
}

/**
 * GC-Stats - public-api-key-status-badges
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { AdminPublicApiKeyRow } from "@/lib/admin-public-api-keys";

export function PublicApiKeyStatusBadges({ apiKey }: { apiKey: Pick<AdminPublicApiKeyRow, "isActive" | "suspended" | "ownerBlocked"> }) {
  const t = useTranslations("admin.publicApiKeys.status");
  return (
    <>
      {apiKey.suspended ? (
        <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400">{t("suspended")}</Badge>
      ) : apiKey.isActive ? (
        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">{t("active")}</Badge>
      ) : (
        <Badge variant="secondary">{t("revoked")}</Badge>
      )}
      {apiKey.ownerBlocked && <Badge variant="destructive">{t("blocked")}</Badge>}
    </>
  );
}

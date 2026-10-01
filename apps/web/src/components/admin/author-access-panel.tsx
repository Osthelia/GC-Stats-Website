/**
 * GC-Stats - author-access-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ActiveStatusBadge } from "@/components/admin/active-status-badge";
import { setUserAuthorAccess } from "@/actions/admin-user-detail";

/**
 * Individual "can author news" grant — independent of any organization
 * (the other way to get it is through an organization's own
 * organization.news.edit/publish permission, see /dashboard's role/
 * permission matrix).
 */
export function AuthorAccessPanel({ userId, isAuthor, canManage }: { userId: string; isAuthor: boolean; canManage: boolean }) {
  const t = useTranslations("admin.users.author");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await setUserAuthorAccess(userId, !isAuthor);
      if (!result.ok) {
        toast.error(t("error.notFound"));
        return;
      }
      router.refresh();
      toast.success(isAuthor ? t("revokeSuccess") : t("grantSuccess"));
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("heading")}</CardTitle>
        <CardDescription>{t("hint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3">
        <ActiveStatusBadge active={isAuthor} activeLabel={t("statusGranted")} inactiveLabel={t("statusNotGranted")} />
        {canManage && (
          <Button variant="outline" size="sm" disabled={isPending} onClick={handleToggle}>
            {isAuthor ? t("revokeButton") : t("grantButton")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * GC-Stats - user-auth-methods-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActiveStatusBadge } from "@/components/admin/active-status-badge";
import { adminDisableTwoFactor, adminRevokeUserSessions } from "@/actions/admin-user-detail";
import type { AdminUserAuthMethods } from "@/lib/admin-user-detail";

export function UserAuthMethodsPanel({ userId, methods, canManage }: { userId: string; methods: AdminUserAuthMethods; canManage: boolean }) {
  const t = useTranslations("admin.users.authMethods");
  const [isPending, startTransition] = useTransition();

  function handleDisableTwoFactor() {
    if (!window.confirm(t("disableTwoFactorConfirm"))) return;
    startTransition(async () => {
      const result = await adminDisableTwoFactor(userId);
      if (!result.ok) {
        toast.error(t(`error.${result.error}`));
        return;
      }
      toast.success(t("disableTwoFactorSuccess"));
    });
  }

  function handleRevokeSessions() {
    if (!window.confirm(t("revokeSessionsConfirm"))) return;
    startTransition(async () => {
      const result = await adminRevokeUserSessions(userId);
      if (!result.ok) {
        toast.error(t(`error.${result.error}`));
        return;
      }
      toast.success(t("revokeSessionsSuccess"));
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("heading")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("password")}</span>
          <ActiveStatusBadge active={methods.hasPassword} activeLabel={t("set")} inactiveLabel={t("notSet")} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("twoFactor")}</span>
          <div className="flex items-center gap-2">
            <ActiveStatusBadge active={methods.twoFactorEnabled} activeLabel={t("enabled")} inactiveLabel={t("disabled")} />
            {canManage && methods.twoFactorEnabled && (
              <Button variant="outline" size="sm" disabled={isPending} onClick={handleDisableTwoFactor}>
                {t("disableTwoFactorButton")}
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("passkeys")}</span>
          <span>{t("passkeyCount", { count: methods.passkeyCount })}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("oauthAccounts")}</span>
          {methods.oauthAccounts.length === 0 ? (
            <span className="text-muted-foreground">{t("none")}</span>
          ) : (
            <div className="flex flex-wrap justify-end gap-1">
              {methods.oauthAccounts.map((a) => (
                <Badge key={a.provider} variant="outline">
                  {a.provider}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("activeSessions")}</span>
          <div className="flex items-center gap-2">
            <span>{methods.activeSessionCount}</span>
            {canManage && methods.activeSessionCount > 0 && (
              <Button variant="outline" size="sm" disabled={isPending} onClick={handleRevokeSessions}>
                {t("revokeSessionsButton")}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

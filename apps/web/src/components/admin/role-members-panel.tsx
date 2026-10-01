/**
 * GC-Stats - role-members-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserPicker } from "@/components/admin/user-picker";
import { addRoleMember, removeRoleMember } from "@/actions/admin-roles";
import type { AdminRoleMember } from "@/lib/admin-roles";

export function RoleMembersPanel({ roleId, initialMembers }: { roleId: number; initialMembers: AdminRoleMember[] }) {
  const t = useTranslations("admin.roles");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [picked, setPicked] = useState<{ id: string; username: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    if (!picked) return;
    setError(null);
    startTransition(async () => {
      const result = await addRoleMember(roleId, picked.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPicked(null);
      router.refresh();
      toast.success(t("memberAdded"));
    });
  }

  function handleRemove(member: AdminRoleMember) {
    if (!window.confirm(t("memberRemoveConfirm", { username: member.username ?? member.email ?? member.id }))) return;
    setError(null);
    startTransition(async () => {
      const result = await removeRoleMember(roleId, member.id);
      if (!result.ok) {
        toast.error(t(`error.${result.error}`));
        return;
      }
      router.refresh();
      toast.success(t("memberRemoved"));
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("sectionMembers")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <UserPicker
            value={picked}
            onChange={setPicked}
            placeholder={t("memberAddPlaceholder")}
            searchPlaceholder={t("memberAddSearchPlaceholder")}
            noResultsLabel={t("memberAddNoResults")}
          />
          <Button variant="outline" size="sm" disabled={isPending || !picked} onClick={handleAdd}>
            {t("memberAddSubmit")}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {t(`error.${error}`)}
          </p>
        )}

        {initialMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("membersEmpty")}</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {initialMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                <div className="flex items-center gap-2.5">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={member.image ?? undefined} alt="" />
                    <AvatarFallback>{(member.username ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-medium">{member.username ?? "—"}</span>
                    {member.email && <span className="text-xs text-muted-foreground">{member.email}</span>}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleRemove(member)}
                  className="text-destructive hover:text-destructive"
                >
                  {t("memberRemove")}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

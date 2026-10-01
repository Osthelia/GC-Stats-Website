/**
 * GC-Stats - role-delete-button
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
import { deleteRole } from "@/actions/admin-roles";

export function RoleDeleteButton({ roleId, roleName }: { roleId: number; roleName: string }) {
  const t = useTranslations("admin.roles");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(t("deleteConfirm", { name: roleName }))) return;
    startTransition(async () => {
      const result = await deleteRole(roleId);
      if (!result.ok) {
        toast.error(t(`error.${result.error}`));
        return;
      }
      toast.success(t("deleteSuccess"));
      router.push("/admin/roles");
    });
  }

  return (
    <Button variant="outline" size="sm" disabled={isPending} onClick={handleDelete} className="text-destructive hover:text-destructive">
      {t("delete")}
    </Button>
  );
}

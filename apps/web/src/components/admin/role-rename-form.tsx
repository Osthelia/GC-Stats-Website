/**
 * GC-Stats - role-rename-form
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
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/admin/form-field";
import { renameRole } from "@/actions/admin-roles";

export function RoleRenameForm({ roleId, initialName }: { roleId: number; initialName: string }) {
  const t = useTranslations("admin.roles");
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await renameRole(roleId, name);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(t("saveSuccess"));
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("sectionName")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <FormField label={t("fieldName")} htmlFor="role-name" required error={error ? t(`error.${error}`) : undefined}>
          <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!error} />
        </FormField>
        <div>
          <Button size="sm" onClick={handleSave} disabled={isPending || !name.trim() || name.trim() === initialName}>
            {t("save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

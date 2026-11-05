/**
 * GC-Stats - public-api-key-edit-form
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/admin/form-field";
import { updatePublicApiKey } from "@/actions/admin-public-api-keys";
import { PUBLIC_API_KEY_FIELD_LIMITS, type PublicApiKeyField, type PublicApiKeyFieldErrors } from "@/lib/public-api/config-shared";

export function PublicApiKeyEditForm({ id, clientName, usageDescription, canManage }: { id: number; clientName: string; usageDescription: string; canManage: boolean }) {
  const t = useTranslations("admin.publicApiKeys");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({ clientName, usageDescription });
  const [fieldErrors, setFieldErrors] = useState<PublicApiKeyFieldErrors>({});

  const err = (field: PublicApiKeyField) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}`, PUBLIC_API_KEY_FIELD_LIMITS[field]) : undefined);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    startTransition(async () => {
      try {
        const result = await updatePublicApiKey(id, form);
        if (!result.ok) {
          if (result.fieldErrors) setFieldErrors(result.fieldErrors);
          toast.error(result.error === "notFound" ? t("notFound") : t("saveError"));
          return;
        }
        toast.success(t("saved"));
        router.refresh();
      } catch {
        toast.error(t("actionFailed"));
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField label={t("clientName")} htmlFor="pk-name" required error={err("clientName")}>
        <Input
          id="pk-name"
          value={form.clientName}
          onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
          maxLength={PUBLIC_API_KEY_FIELD_LIMITS.clientName.max}
          disabled={!canManage || isPending}
          aria-invalid={!!fieldErrors.clientName}
          className="text-base font-medium"
        />
      </FormField>
      <FormField label={t("usageDescription")} htmlFor="pk-usage" required error={err("usageDescription")}>
        <Textarea
          id="pk-usage"
          value={form.usageDescription}
          onChange={(e) => setForm((f) => ({ ...f, usageDescription: e.target.value }))}
          maxLength={PUBLIC_API_KEY_FIELD_LIMITS.usageDescription.max}
          rows={8}
          disabled={!canManage || isPending}
          aria-invalid={!!fieldErrors.usageDescription}
          className="min-h-48 text-[15px] leading-relaxed"
        />
      </FormField>
      {canManage && (
        <Button type="submit" disabled={isPending} className="w-fit">
          {isPending ? t("saving") : t("save")}
        </Button>
      )}
    </form>
  );
}

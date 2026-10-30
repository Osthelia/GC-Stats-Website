/**
 * GC-Stats - public-api-settings-form
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { KeyRound, ListIcon } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/admin/form-field";
import { SwitchRow } from "@/components/admin/switch-row";
import { updatePublicApiSettings, type PublicApiSettingsFieldErrors } from "@/actions/admin-settings";
import { PUBLIC_API_LIMIT_BOUNDS, type PublicApiConfig } from "@/lib/public-api/config-shared";

type FormState = { enabled: boolean; ratePerSecond: string; maxKeysPerUser: string };

function toNumber(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

export function PublicApiSettingsForm({ initialConfig, canManage }: { initialConfig: PublicApiConfig; canManage: boolean }) {
  const t = useTranslations("admin.settings");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<PublicApiSettingsFieldErrors>({});
  const [form, setForm] = useState<FormState>({
    enabled: initialConfig.enabled,
    ratePerSecond: String(initialConfig.ratePerSecond),
    maxKeysPerUser: String(initialConfig.maxKeysPerUser),
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const disabled = !canManage || isPending;

  const err = (field: keyof PublicApiSettingsFieldErrors, bounds?: { min: number; max: number }) =>
    fieldErrors[field] ? t(`error.${fieldErrors[field]}`, { min: bounds?.min ?? 0, max: bounds?.max ?? 0 }) : undefined;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof updatePublicApiSettings>>;
      try {
        result = await updatePublicApiSettings({ enabled: form.enabled, ratePerSecond: toNumber(form.ratePerSecond), maxKeysPerUser: toNumber(form.maxKeysPerUser) });
      } catch (error) {
        console.error("[public-api] settings save failed", error);
        toast.error(t("saveFailed"));
        return;
      }
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        toast.error(t("saveError"));
        return;
      }
      router.refresh();
      toast.success(t("saveSuccess"));
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4" />
            {t("publicApi.title")}
          </CardTitle>
          <CardDescription>{t("publicApi.description")}</CardDescription>
          <CardAction>
            <Link href="/admin/api-keys/public" className={buttonVariants({ size: "sm", variant: "outline" })}>
              <ListIcon />
              {t("publicApi.keys")}
            </Link>
          </CardAction>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <SwitchRow
            id="papi-enabled"
            label={t("publicApi.enabled")}
            description={t("publicApi.enabledHint")}
            checked={form.enabled}
            onChange={(v) => set("enabled", v)}
            disabled={disabled}
            error={err("enabled")}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              label={t("publicApi.ratePerSecond")}
              htmlFor="papi-rate"
              required
              error={err("ratePerSecond", PUBLIC_API_LIMIT_BOUNDS.ratePerSecond)}
              hint={t("publicApi.ratePerSecondHint", PUBLIC_API_LIMIT_BOUNDS.ratePerSecond)}
            >
              <Input
                id="papi-rate"
                type="number"
                inputMode="numeric"
                min={PUBLIC_API_LIMIT_BOUNDS.ratePerSecond.min}
                max={PUBLIC_API_LIMIT_BOUNDS.ratePerSecond.max}
                value={form.ratePerSecond}
                onChange={(e) => set("ratePerSecond", e.target.value)}
                disabled={disabled}
                aria-invalid={!!fieldErrors.ratePerSecond}
              />
            </FormField>
            <FormField
              label={t("publicApi.maxKeysPerUser")}
              htmlFor="papi-max-keys"
              required
              error={err("maxKeysPerUser", PUBLIC_API_LIMIT_BOUNDS.maxKeysPerUser)}
              hint={t("publicApi.maxKeysPerUserHint", PUBLIC_API_LIMIT_BOUNDS.maxKeysPerUser)}
            >
              <Input
                id="papi-max-keys"
                type="number"
                inputMode="numeric"
                min={PUBLIC_API_LIMIT_BOUNDS.maxKeysPerUser.min}
                max={PUBLIC_API_LIMIT_BOUNDS.maxKeysPerUser.max}
                value={form.maxKeysPerUser}
                onChange={(e) => set("maxKeysPerUser", e.target.value)}
                disabled={disabled}
                aria-invalid={!!fieldErrors.maxKeysPerUser}
              />
            </FormField>
          </div>
          <p className="text-xs text-muted-foreground">{t("publicApi.propagationHint")}</p>
        </CardContent>

        {canManage && (
          <CardFooter className="justify-end border-t py-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? t("saving") : t("save")}
            </Button>
          </CardFooter>
        )}
      </Card>
    </form>
  );
}

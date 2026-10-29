/**
 * GC-Stats - opendata-settings-form
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Activity, Database, ExternalLinkIcon } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/admin/form-field";
import { updateOpenDataSettings, type OpenDataSettingsFieldErrors } from "@/actions/admin-settings";
import { OPENDATA_LIMIT_BOUNDS, type OpenDataConfig } from "@/lib/opendata/config-shared";

type FormState = { enabled: boolean; requireAccount: boolean; browsePerMinute: string; exportsPerHour: string };

function toNumber(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

function SwitchRow({ id, label, description, checked, onChange, disabled, error }: { id: string; label: string; description: string; checked: boolean; onChange: (v: boolean) => void; disabled: boolean; error?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <p className="text-xs text-muted-foreground">{description}</p>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

export function OpenDataSettingsForm({ initialConfig, canManage }: { initialConfig: OpenDataConfig; canManage: boolean }) {
  const t = useTranslations("admin.settings");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<OpenDataSettingsFieldErrors>({});
  const [form, setForm] = useState<FormState>({
    enabled: initialConfig.enabled,
    requireAccount: initialConfig.requireAccount,
    browsePerMinute: String(initialConfig.browsePerMinute),
    exportsPerHour: String(initialConfig.exportsPerHour),
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const disabled = !canManage || isPending;

  const err = (field: keyof OpenDataSettingsFieldErrors, bounds?: { min: number; max: number }) =>
    fieldErrors[field] ? t(`error.${fieldErrors[field]}`, { min: bounds?.min ?? 0, max: bounds?.max ?? 0 }) : undefined;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof updateOpenDataSettings>>;
      try {
        result = await updateOpenDataSettings({
          enabled: form.enabled,
          requireAccount: form.requireAccount,
          browsePerMinute: toNumber(form.browsePerMinute),
          exportsPerHour: toNumber(form.exportsPerHour),
        });
      } catch (error) {
        // Expired session or failed write.
        console.error("[opendata] settings save failed", error);
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
            <Database className="size-4" />
            {t("opendata.title")}
          </CardTitle>
          <CardDescription>{t("opendata.description")}</CardDescription>
          <CardAction className="flex flex-wrap gap-2">
            <Link href="/opendata" target="_blank" rel="noopener" className={buttonVariants({ size: "sm", variant: "outline" })}>
              <ExternalLinkIcon />
              {t("opendata.publicPortal")}
            </Link>
            <Link href="/admin/settings/opendata" className={buttonVariants({ size: "sm" })}>
              <Activity />
              {t("opendata.monitoring")}
            </Link>
          </CardAction>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <SwitchRow
            id="od-enabled"
            label={t("opendata.enabled")}
            description={t("opendata.enabledHint")}
            checked={form.enabled}
            onChange={(v) => set("enabled", v)}
            disabled={disabled}
            error={err("enabled")}
          />
          <SwitchRow
            id="od-require-account"
            label={t("opendata.requireAccount")}
            description={t("opendata.requireAccountHint")}
            checked={form.requireAccount}
            onChange={(v) => set("requireAccount", v)}
            disabled={disabled}
            error={err("requireAccount")}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              label={t("opendata.browsePerMinute")}
              htmlFor="od-browse"
              required
              error={err("browsePerMinute", OPENDATA_LIMIT_BOUNDS.browsePerMinute)}
              hint={t("opendata.browsePerMinuteHint", OPENDATA_LIMIT_BOUNDS.browsePerMinute)}
            >
              <Input
                id="od-browse"
                type="number"
                inputMode="numeric"
                min={OPENDATA_LIMIT_BOUNDS.browsePerMinute.min}
                max={OPENDATA_LIMIT_BOUNDS.browsePerMinute.max}
                value={form.browsePerMinute}
                onChange={(e) => set("browsePerMinute", e.target.value)}
                disabled={disabled}
                aria-invalid={!!fieldErrors.browsePerMinute}
              />
            </FormField>
            <FormField
              label={t("opendata.exportsPerHour")}
              htmlFor="od-exports"
              required
              error={err("exportsPerHour", OPENDATA_LIMIT_BOUNDS.exportsPerHour)}
              hint={t("opendata.exportsPerHourHint", OPENDATA_LIMIT_BOUNDS.exportsPerHour)}
            >
              <Input
                id="od-exports"
                type="number"
                inputMode="numeric"
                min={OPENDATA_LIMIT_BOUNDS.exportsPerHour.min}
                max={OPENDATA_LIMIT_BOUNDS.exportsPerHour.max}
                value={form.exportsPerHour}
                onChange={(e) => set("exportsPerHour", e.target.value)}
                disabled={disabled}
                aria-invalid={!!fieldErrors.exportsPerHour}
              />
            </FormField>
          </div>

          <p className="text-xs text-muted-foreground">{t("opendata.propagationHint")}</p>
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

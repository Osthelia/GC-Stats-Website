/**
 * GC-Stats - org-profile-form
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormField } from "@/components/admin/form-field";
import { CountrySelect } from "@/components/admin/country-select";
import { CountryFlag } from "@/components/admin/country-flag";
import { updateDashboardOrganizationProfile, type OrganizationProfileFieldErrors } from "@/actions/dashboard-organizations";
import type { AdminOrganizationProfile } from "@/lib/admin-organizations";
import { ORGANIZATION_TAGS } from "@/lib/organization-tags";
import { ORGANIZATION_SOCIAL_KEYS } from "@/lib/organization-profile-validation";

/** Read-only display for a member without organization.profile.edit: the full form only mounts once someone can actually save it, see components/dashboard/org-profile-form.tsx canEdit prop. */
function ReadOnlyProfile({ organization }: { organization: AdminOrganizationProfile }) {
  const t = useTranslations("admin.organizations.edit");
  const tTags = useTranslations("admin.organizations.tagOptions");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t("sectionProfile")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="flex items-center gap-2">
            <CountryFlag code={organization.countryCode} secondaryCode={organization.secondaryCountryCode} className="size-4" />
            <span className="font-medium">{organization.name}</span>
          </div>
          <p className="text-muted-foreground">@{organization.slug}</p>
          <div className="flex flex-wrap gap-1.5">
            {organization.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tTags(tag)}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("sectionSocials")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5 text-sm">
          {ORGANIZATION_SOCIAL_KEYS.filter((k) => organization.socials[k]).map((k) => (
            <div key={k} className="flex justify-between gap-2">
              <span className="text-muted-foreground">{t(`socialLabels.${k}`)}</span>
              <span className="truncate">{organization.socials[k]}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function OrgProfileForm({ organization, canEdit }: { organization: AdminOrganizationProfile; canEdit: boolean }) {
  const t = useTranslations("admin.organizations.edit");
  const tDash = useTranslations("dashboard.profile");
  const tTags = useTranslations("admin.organizations.tagOptions");
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<OrganizationProfileFieldErrors>({});

  const [name, setName] = useState(organization.name);
  const [slug, setSlug] = useState(organization.slug);
  const [countryCode, setCountryCode] = useState(organization.countryCode ?? "");
  const [secondaryCountryCode, setSecondaryCountryCode] = useState(organization.secondaryCountryCode ?? "");
  const [socials, setSocials] = useState<Record<string, string>>(organization.socials);
  const [tags, setTags] = useState<string[]>(organization.tags);

  if (!canEdit) {
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{tDash("readOnlyHint")}</p>
        <ReadOnlyProfile organization={organization} />
      </div>
    );
  }

  function handleSave() {
    setErrors({});
    startTransition(async () => {
      const result = await updateDashboardOrganizationProfile(organization.id, { name, slug, countryCode, secondaryCountryCode, socials, tags });
      if (!result.ok) {
        setErrors(result.fieldErrors);
        toast.error(t("save"));
        return;
      }
      toast.success(t("saveSuccess"));
    });
  }

  const err = (field: keyof OrganizationProfileFieldErrors) => (errors[field] ? t(`error.${errors[field]}`) : undefined);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <Card className="border-primary/15">
          <CardHeader>
            <CardTitle>{t("sectionProfile")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FormField label={t("fieldName")} htmlFor="dashboard-org-name" required error={err("name")}>
              <Input id="dashboard-org-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} />
            </FormField>

            <FormField label={t("fieldSlug")} htmlFor="dashboard-org-slug" required hint={t("fieldSlugHint")} error={err("slug")}>
              <Input id="dashboard-org-slug" value={slug} onChange={(e) => setSlug(e.target.value)} aria-invalid={!!errors.slug} />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label={t("fieldCountry")} htmlFor="dashboard-org-country" error={err("countryCode")}>
                <CountrySelect
                  id="dashboard-org-country"
                  value={countryCode}
                  onChange={setCountryCode}
                  placeholder={t("fieldCountryPlaceholder")}
                  clearLabel={t("fieldCountryClear")}
                  invalid={!!errors.countryCode}
                />
              </FormField>
              <FormField label={t("fieldSecondaryCountry")} htmlFor="dashboard-org-secondary-country" error={err("secondaryCountryCode")}>
                <CountrySelect
                  id="dashboard-org-secondary-country"
                  value={secondaryCountryCode}
                  onChange={setSecondaryCountryCode}
                  placeholder={t("fieldCountryPlaceholder")}
                  clearLabel={t("fieldCountryClear")}
                  invalid={!!errors.secondaryCountryCode}
                />
              </FormField>
            </div>
          </CardContent>
        </Card>

        <Card className="border-sidebar-primary/25">
          <CardHeader>
            <CardTitle>{t("sectionSocials")}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            {ORGANIZATION_SOCIAL_KEYS.map((key) => (
              <FormField
                key={key}
                label={t(`socialLabels.${key}`)}
                htmlFor={`dashboard-org-social-${key}`}
                error={errors.socials?.[key] ? t(`error.${errors.socials[key]}`) : undefined}
              >
                <Input
                  id={`dashboard-org-social-${key}`}
                  value={socials[key] ?? ""}
                  onChange={(e) => setSocials((prev) => ({ ...prev, [key]: e.target.value }))}
                  aria-invalid={!!errors.socials?.[key]}
                />
              </FormField>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("sectionTags")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">{t("tagsHint")}</p>
          <div className="flex flex-wrap gap-1.5">
            {ORGANIZATION_TAGS.map((tag) => {
              const active = tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setTags((prev) => (active ? prev.filter((v) => v !== tag) : [...prev, tag]))}
                  aria-pressed={active}
                  className="cursor-pointer rounded-full transition-all hover:-translate-y-0.5 hover:opacity-90"
                >
                  <Badge variant={active ? "default" : "outline"}>{tTags(tag)}</Badge>
                </button>
              );
            })}
          </div>
          {err("tags") && (
            <p role="alert" className="text-xs text-destructive">
              {err("tags")}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? (
            <>
              <Loader2Icon className="size-3.5 animate-spin" />
              {t("saving")}
            </>
          ) : (
            t("save")
          )}
        </Button>
      </div>
    </div>
  );
}

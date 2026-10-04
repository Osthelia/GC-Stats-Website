/**
 * GC-Stats - organization-edit-form
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormField } from "@/components/admin/form-field";
import { CountrySelect } from "@/components/admin/country-select";
import { updateOrganizationProfile, type OrganizationProfileFieldErrors } from "@/actions/admin-organizations";
import type { AdminOrganizationProfile } from "@/lib/admin-organizations";
import { ORGANIZATION_TAGS } from "@/lib/organization-tags";
import { cn } from "@/lib/utils";

const SOCIAL_KEYS = ["twitter", "twitch", "instagram", "youtube", "tiktok", "discord", "website"] as const;

export function OrganizationEditForm({
  organization,
  rightExtra,
}: {
  organization: AdminOrganizationProfile;
  /** Rendered in the right column, below Socials — e.g. logo panel. */
  rightExtra?: React.ReactNode;
}) {
  const t = useTranslations("admin.organizations.edit");
  const tTags = useTranslations("admin.organizations.tagOptions");
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<OrganizationProfileFieldErrors>({});

  const [name, setName] = useState(organization.name);
  const [slug, setSlug] = useState(organization.slug);
  const [countryCode, setCountryCode] = useState(organization.countryCode ?? "");
  const [secondaryCountryCode, setSecondaryCountryCode] = useState(organization.secondaryCountryCode ?? "");
  const [bio, setBio] = useState(organization.bio ?? "");
  const [socials, setSocials] = useState<Record<string, string>>(organization.socials);
  const [tags, setTags] = useState<string[]>(organization.tags);

  function handleSave() {
    setErrors({});
    startTransition(async () => {
      const result = await updateOrganizationProfile(organization.id, { name, slug, countryCode, secondaryCountryCode, bio, socials, tags });
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
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("sectionProfile")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <FormField label={t("fieldName")} htmlFor="organization-name" required error={err("name")}>
                <Input id="organization-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} />
              </FormField>

              <FormField label={t("fieldSlug")} htmlFor="organization-slug" required hint={t("fieldSlugHint")} error={err("slug")}>
                <Input id="organization-slug" value={slug} onChange={(e) => setSlug(e.target.value)} aria-invalid={!!errors.slug} />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("fieldCountry")} htmlFor="organization-country" error={err("countryCode")}>
                  <CountrySelect
                    id="organization-country"
                    value={countryCode}
                    onChange={setCountryCode}
                    placeholder={t("fieldCountryPlaceholder")}
                    clearLabel={t("fieldCountryClear")}
                    invalid={!!errors.countryCode}
                  />
                </FormField>
                <FormField label={t("fieldSecondaryCountry")} htmlFor="organization-secondary-country" error={err("secondaryCountryCode")}>
                  <CountrySelect
                    id="organization-secondary-country"
                    value={secondaryCountryCode}
                    onChange={setSecondaryCountryCode}
                    placeholder={t("fieldCountryPlaceholder")}
                    clearLabel={t("fieldCountryClear")}
                    invalid={!!errors.secondaryCountryCode}
                  />
                </FormField>
              </div>

              <FormField label={t("fieldBio")} htmlFor="organization-bio" error={err("bio")}>
                <Textarea id="organization-bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={4} maxLength={2000} aria-invalid={!!errors.bio} />
              </FormField>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("sectionTags")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">{t("tagsHint")}</p>
              {/* Fixed, curated vocabulary (see lib/organization-tags.ts) — what an
                  organization does, shown to visitors, not a free-text field an
                  admin could turn into "Tournament_Org" / "tournament org" / etc. */}
              <div className="flex flex-wrap gap-1.5">
                {ORGANIZATION_TAGS.map((tag) => {
                  const active = tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setTags((prev) => (active ? prev.filter((v) => v !== tag) : [...prev, tag]))}
                      aria-pressed={active}
                      className="cursor-pointer rounded-full transition-opacity hover:opacity-80"
                    >
                      <Badge variant={active ? "default" : "outline"} className={cn(!active && "text-muted-foreground")}>
                        {tTags(tag)}
                      </Badge>
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
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("sectionSocials")}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              {SOCIAL_KEYS.map((key) => (
                <FormField
                  key={key}
                  label={t(`socialLabels.${key}`)}
                  htmlFor={`organization-social-${key}`}
                  error={errors.socials?.[key] ? t(`error.${errors.socials[key]}`) : undefined}
                >
                  <Input
                    id={`organization-social-${key}`}
                    value={socials[key] ?? ""}
                    onChange={(e) => setSocials((prev) => ({ ...prev, [key]: e.target.value }))}
                    aria-invalid={!!errors.socials?.[key]}
                  />
                </FormField>
              ))}
            </CardContent>
          </Card>

          {rightExtra}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          {t("save")}
        </Button>
      </div>
    </div>
  );
}

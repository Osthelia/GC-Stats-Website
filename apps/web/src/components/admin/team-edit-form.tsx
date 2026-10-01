/**
 * GC-Stats - team-edit-form
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
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/admin/form-field";
import { CountrySelect } from "@/components/admin/country-select";
import { TagsInput } from "@/components/admin/tags-input";
import { updateTeamProfile, type TeamProfileFieldErrors } from "@/actions/admin-teams";
import type { AdminTeamProfile } from "@/lib/admin-teams";

const SOCIAL_KEYS = ["twitter", "twitch", "instagram", "youtube", "tiktok", "discord", "website"] as const;

export function TeamEditForm({
  team,
  rightExtra,
}: {
  team: AdminTeamProfile;
  /** Rendered in the right column, below Socials — e.g. logo/name-history panels. */
  rightExtra?: React.ReactNode;
}) {
  const t = useTranslations("admin.teams.edit");
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<TeamProfileFieldErrors>({});

  const [name, setName] = useState(team.name);
  const [shortName, setShortName] = useState(team.shortName ?? "");
  const [countryCode, setCountryCode] = useState(team.countryCode ?? "");
  const [secondaryCountryCode, setSecondaryCountryCode] = useState(team.secondaryCountryCode ?? "");
  const [bio, setBio] = useState(team.bio ?? "");
  const [vlrId, setVlrId] = useState(team.vlrId ? String(team.vlrId) : "");
  const [liquipediaLink, setLiquipediaLink] = useState(team.liquipediaLink ?? "");
  const [isActive, setIsActive] = useState(team.isActive);
  const [socials, setSocials] = useState<Record<string, string>>(team.socials);
  const [tags, setTags] = useState<string[]>(team.tags);

  function handleSave() {
    setErrors({});
    startTransition(async () => {
      const result = await updateTeamProfile(team.id, { name, shortName, countryCode, secondaryCountryCode, bio, vlrId, liquipediaLink, isActive, socials, tags });
      if (!result.ok) {
        setErrors(result.fieldErrors);
        toast.error(t("save"));
        return;
      }
      toast.success(t("saveSuccess"));
    });
  }

  const err = (field: keyof TeamProfileFieldErrors) => (errors[field] ? t(`error.${errors[field]}`) : undefined);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("sectionProfile")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <FormField label={t("fieldName")} htmlFor="team-name" required error={err("name")}>
                <Input id="team-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("fieldShortName")} htmlFor="team-short-name" error={err("shortName")}>
                  <Input id="team-short-name" value={shortName} onChange={(e) => setShortName(e.target.value)} maxLength={10} aria-invalid={!!errors.shortName} />
                </FormField>
                <FormField label={t("fieldCountry")} htmlFor="team-country" error={err("countryCode")}>
                  <CountrySelect
                    id="team-country"
                    value={countryCode}
                    onChange={setCountryCode}
                    placeholder={t("fieldCountryPlaceholder")}
                    clearLabel={t("fieldCountryClear")}
                    invalid={!!errors.countryCode}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("fieldSecondaryCountry")} htmlFor="team-secondary-country" error={err("secondaryCountryCode")}>
                  <CountrySelect
                    id="team-secondary-country"
                    value={secondaryCountryCode}
                    onChange={setSecondaryCountryCode}
                    placeholder={t("fieldCountryPlaceholder")}
                    clearLabel={t("fieldCountryClear")}
                    invalid={!!errors.secondaryCountryCode}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("fieldVlrId")} htmlFor="team-vlr-id" error={err("vlrId")}>
                  <Input id="team-vlr-id" inputMode="numeric" value={vlrId} onChange={(e) => setVlrId(e.target.value)} aria-invalid={!!errors.vlrId} />
                </FormField>
                <FormField label={t("fieldLiquipedia")} htmlFor="team-liquipedia" error={err("liquipediaLink")}>
                  <Input id="team-liquipedia" value={liquipediaLink} onChange={(e) => setLiquipediaLink(e.target.value)} aria-invalid={!!errors.liquipediaLink} />
                </FormField>
              </div>

              <FormField label={t("fieldBio")} htmlFor="team-bio" error={err("bio")}>
                <Textarea id="team-bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={4} maxLength={2000} aria-invalid={!!errors.bio} />
              </FormField>

              <label className="flex items-center gap-2.5 text-sm">
                <Checkbox checked={isActive} onCheckedChange={(v) => setIsActive(v === true)} />
                {t("fieldActive")}
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("sectionTags")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">{t("tagsHint")}</p>
              <TagsInput
                value={tags}
                onChange={setTags}
                placeholder={t("tagsPlaceholder")}
                addLabel={t("tagsAdd")}
                emptyLabel={t("tagsEmpty")}
                removeLabel={t("tagsRemove")}
              />
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
                <FormField key={key} label={key.charAt(0).toUpperCase() + key.slice(1)} htmlFor={`team-social-${key}`}>
                  <Input
                    id={`team-social-${key}`}
                    value={socials[key] ?? ""}
                    onChange={(e) => setSocials((prev) => ({ ...prev, [key]: e.target.value }))}
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

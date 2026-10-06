/**
 * GC-Stats - player-edit-form
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/admin/form-field";
import { CountrySelect } from "@/components/admin/country-select";
import { TagsInput } from "@/components/admin/tags-input";
import { updatePlayerProfile, type PlayerProfileFieldErrors } from "@/actions/admin-players";
import type { AdminPlayerProfile } from "@/lib/admin-players";
import { PERSON_SOCIAL_KEYS } from "@/lib/person-social-keys";
const PRONOUN_VALUES = ["0", "1", "2"] as const;

export function PlayerEditForm({
  player,
  canEdit,
  rightExtra,
}: {
  player: AdminPlayerProfile;
  canEdit: boolean;
  /** Rendered in the right column, below Socials — e.g. the logo panel. */
  rightExtra?: React.ReactNode;
}) {
  const t = useTranslations("admin.players.edit");
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<PlayerProfileFieldErrors>({});

  const [handle, setHandle] = useState(player.handle);
  const [aliases, setAliases] = useState<string[]>(player.aliases);
  const [firstName, setFirstName] = useState(player.firstName ?? "");
  const [lastName, setLastName] = useState(player.lastName ?? "");
  const [countryCode, setCountryCode] = useState(player.countryCode ?? "");
  const [secondaryCountryCode, setSecondaryCountryCode] = useState(player.secondaryCountryCode ?? "");
  const [pronouns, setPronouns] = useState(player.pronouns !== null ? String(player.pronouns) : "");
  const [bio, setBio] = useState(player.bio ?? "");
  const [vlrId, setVlrId] = useState(player.vlrId ? String(player.vlrId) : "");
  const [valId, setValId] = useState(player.valId ?? "");
  const [esportsValId, setEsportsValId] = useState(player.esportsValId ?? "");
  const [liquipediaLink, setLiquipediaLink] = useState(player.liquipediaLink ?? "");
  const [isActive, setIsActive] = useState(player.isActive);
  const [socials, setSocials] = useState<Record<string, string>>(player.socials);

  function handleSave() {
    setErrors({});
    startTransition(async () => {
      const result = await updatePlayerProfile(player.id, {
        handle,
        aliases,
        firstName,
        lastName,
        countryCode,
        secondaryCountryCode,
        pronouns,
        bio,
        vlrId,
        valId,
        esportsValId,
        liquipediaLink,
        isActive,
        socials,
      });
      if (!result.ok) {
        setErrors(result.fieldErrors);
        toast.error(t("save"));
        return;
      }
      toast.success(t("saveSuccess"));
    });
  }

  const err = (field: keyof PlayerProfileFieldErrors) => (errors[field] ? t(`error.${errors[field]}`) : undefined);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("sectionProfile")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <FormField label={t("fieldHandle")} htmlFor="player-handle" required error={err("handle")}>
                <Input id="player-handle" value={handle} onChange={(e) => setHandle(e.target.value)} aria-invalid={!!errors.handle} disabled={!canEdit} />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("fieldFirstName")} htmlFor="player-first-name">
                  <Input id="player-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={!canEdit} />
                </FormField>
                <FormField label={t("fieldLastName")} htmlFor="player-last-name">
                  <Input id="player-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={!canEdit} />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("fieldCountry")} htmlFor="player-country" error={err("countryCode")}>
                  <CountrySelect
                    id="player-country"
                    value={countryCode}
                    onChange={setCountryCode}
                    placeholder={t("fieldCountryPlaceholder")}
                    clearLabel={t("fieldCountryClear")}
                    invalid={!!errors.countryCode}
                    disabled={!canEdit}
                  />
                </FormField>
                <FormField label={t("fieldPronouns")} htmlFor="player-pronouns" error={err("pronouns")}>
                  <Select
                    items={{ none: t("fieldPronounsNone"), [PRONOUN_VALUES[0]]: t("pronounFeminine"), [PRONOUN_VALUES[1]]: t("pronounMasculine"), [PRONOUN_VALUES[2]]: t("pronounNeutral") }}
                    value={pronouns || "none"}
                    onValueChange={(v) => setPronouns(v && v !== "none" ? v : "")}
                    disabled={!canEdit}
                  >
                    <SelectTrigger id="player-pronouns" aria-invalid={!!errors.pronouns} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("fieldPronounsNone")}</SelectItem>
                      <SelectItem value={PRONOUN_VALUES[0]}>{t("pronounFeminine")}</SelectItem>
                      <SelectItem value={PRONOUN_VALUES[1]}>{t("pronounMasculine")}</SelectItem>
                      <SelectItem value={PRONOUN_VALUES[2]}>{t("pronounNeutral")}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("fieldSecondaryCountry")} htmlFor="player-secondary-country" error={err("secondaryCountryCode")}>
                  <CountrySelect
                    id="player-secondary-country"
                    value={secondaryCountryCode}
                    onChange={setSecondaryCountryCode}
                    placeholder={t("fieldCountryPlaceholder")}
                    clearLabel={t("fieldCountryClear")}
                    invalid={!!errors.secondaryCountryCode}
                    disabled={!canEdit}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("fieldVlrId")} htmlFor="player-vlr-id" error={err("vlrId")}>
                  <Input id="player-vlr-id" inputMode="numeric" value={vlrId} onChange={(e) => setVlrId(e.target.value)} aria-invalid={!!errors.vlrId} disabled={!canEdit} />
                </FormField>
                <FormField label={t("fieldLiquipedia")} htmlFor="player-liquipedia" error={err("liquipediaLink")}>
                  <Input id="player-liquipedia" value={liquipediaLink} onChange={(e) => setLiquipediaLink(e.target.value)} aria-invalid={!!errors.liquipediaLink} disabled={!canEdit} />
                </FormField>
              </div>

              <FormField label={t("fieldBio")} htmlFor="player-bio" error={err("bio")}>
                <Textarea id="player-bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={4} maxLength={2000} aria-invalid={!!errors.bio} disabled={!canEdit} />
              </FormField>

              <label className="flex items-center gap-2.5 text-sm">
                <Checkbox checked={isActive} onCheckedChange={(v) => setIsActive(v === true)} disabled={!canEdit} />
                {t("fieldActive")}
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("sectionAliases")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">{t("aliasesHint")}</p>
              <TagsInput
                value={aliases}
                onChange={setAliases}
                placeholder={t("aliasesPlaceholder")}
                addLabel={t("aliasesAdd")}
                emptyLabel={t("aliasesEmpty")}
                removeLabel={t("aliasesRemove")}
                disabled={!canEdit}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("sectionIdentifiers")}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <FormField label={t("fieldValId")} htmlFor="player-val-id" error={err("valId")}>
                <Input id="player-val-id" value={valId} onChange={(e) => setValId(e.target.value)} aria-invalid={!!errors.valId} disabled={!canEdit} />
              </FormField>
              <FormField label={t("fieldEsportsValId")} htmlFor="player-esports-val-id" error={err("esportsValId")}>
                <Input id="player-esports-val-id" value={esportsValId} onChange={(e) => setEsportsValId(e.target.value)} aria-invalid={!!errors.esportsValId} disabled={!canEdit} />
              </FormField>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("sectionSocials")}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              {PERSON_SOCIAL_KEYS.map((key) => (
                <FormField
                  key={key}
                  label={key === "discord" ? t("fieldDiscordId") : key.charAt(0).toUpperCase() + key.slice(1)}
                  htmlFor={`player-social-${key}`}
                  hint={key === "discord" ? t("discordIdHint") : undefined}
                  error={errors.socials?.[key] ? t(`error.${errors.socials[key]}`) : undefined}
                >
                  <Input
                    id={`player-social-${key}`}
                    inputMode={key === "discord" ? "numeric" : undefined}
                    value={socials[key] ?? ""}
                    onChange={(e) => setSocials((prev) => ({ ...prev, [key]: e.target.value }))}
                    aria-invalid={!!errors.socials?.[key]}
                    disabled={!canEdit}
                  />
                </FormField>
              ))}
            </CardContent>
          </Card>

          {rightExtra}
        </div>
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isPending}>
            {t("save")}
          </Button>
        </div>
      )}
    </div>
  );
}

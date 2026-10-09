/**
 * GC-Stats - edit-person-profile-dialog
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/admin/form-field";
import { CountrySelect } from "@/components/admin/country-select";
import { TagsInput } from "@/components/admin/tags-input";
import { getPersonProfileForOrganization, updatePersonProfileForOrganization, uploadPersonPhotoForOrganization, type OrgPersonProfileFieldErrors } from "@/actions/dashboard-organizations";
import { OrgLogoTile } from "@/components/dashboard/org-logo";
import { PERSON_SOCIAL_KEYS } from "@/lib/person-social-keys";

const PRONOUN_VALUES = ["0", "1", "2"] as const;

/**
 * Dashboard-scoped profile editor for a roster person, gated by the
 * separate peopleEditProfile permission, mirrors admin's PlayerEditForm
 * but only the "Basic info"/"Advanced info" fields an organization is
 * allowed to touch (see updatePersonProfileForOrganization). A dialog
 * rather than a full page: this is opened from a member row, not its own
 * route (no dashboard page lists people outside the org roster).
 */
export function EditPersonProfileDialog({ organizationId, personId, handle, onSaved }: { organizationId: number; personId: number; handle: string; onSaved: (handle: string) => void }) {
  const t = useTranslations("dashboard.members");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<OrgPersonProfileFieldErrors>({});

  const [editHandle, setEditHandle] = useState(handle);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [vlrId, setVlrId] = useState("");
  const [liquipediaLink, setLiquipediaLink] = useState("");
  const [aliases, setAliases] = useState<string[]>([]);
  const [socials, setSocials] = useState<Record<string, string>>({});
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setFieldErrors({});
    setPhotoFile(null);
    getPersonProfileForOrganization(organizationId, personId).then((profile) => {
      if (!profile) {
        setOpen(false);
        return;
      }
      setEditHandle(profile.handle);
      setFirstName(profile.firstName);
      setLastName(profile.lastName);
      setCountryCode(profile.countryCode);
      setPronouns(profile.pronouns);
      setVlrId(profile.vlrId);
      setLiquipediaLink(profile.liquipediaLink);
      setAliases(profile.aliases);
      setSocials(profile.socials);
      setPhotoUrl(profile.photoUrl);
      setLoading(false);
    });
  }, [open, organizationId, personId]);

  function handleSave() {
    setFieldErrors({});
    startTransition(async () => {
      if (photoFile) {
        const formData = new FormData();
        formData.set("file", photoFile);
        const upload = await uploadPersonPhotoForOrganization(organizationId, personId, formData);
        if (!upload.ok) {
          setFieldErrors({ photo: upload.error });
          return;
        }
        setPhotoUrl(null);
        setPhotoFile(null);
      }
      const result = await updatePersonProfileForOrganization(organizationId, personId, {
        handle: editHandle,
        firstName,
        lastName,
        countryCode,
        pronouns,
        vlrId,
        liquipediaLink,
        aliases,
        socials,
      });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      setOpen(false);
      onSaved(editHandle.trim());
      toast.success(t("editProfileSuccess"));
    });
  }

  const err = (field: keyof OrgPersonProfileFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field] as string}` as "error.invalid") : undefined);

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {t("editProfileButton")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editProfileTitle", { handle })}</DialogTitle>
            <DialogDescription>{t("editProfileDescription")}</DialogDescription>
          </DialogHeader>

          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("editProfileLoading")}</p>
          ) : (
            <div className="flex flex-col gap-5 py-2">
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{t("editProfileBasicSection")}</p>
                <FormField label={t("editProfilePhotoLabel")} htmlFor="edit-person-photo" hint={t("editProfilePhotoNotes")} error={err("photo")}>
                  <div className="flex items-center gap-3">
                    <OrgLogoTile name={editHandle || handle} logoUrl={photoPreview ?? photoUrl} className="size-20 rounded-lg border text-xl" />
                    <input
                      id="edit-person-photo"
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        setPhotoFile(e.target.files?.[0] ?? null);
                        setFieldErrors((prev) => ({ ...prev, photo: undefined }));
                      }}
                    />
                    <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => photoInputRef.current?.click()} aria-invalid={!!fieldErrors.photo}>
                      {photoPreview || photoUrl ? t("editProfilePhotoReplace") : t("editProfilePhotoChoose")}
                    </Button>
                  </div>
                </FormField>
                <FormField label={t("editProfileHandleLabel")} htmlFor="edit-person-handle" required error={err("handle")}>
                  <Input id="edit-person-handle" value={editHandle} onChange={(e) => setEditHandle(e.target.value)} aria-invalid={!!fieldErrors.handle} />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label={t("editProfileFirstNameLabel")} htmlFor="edit-person-first-name">
                    <Input id="edit-person-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </FormField>
                  <FormField label={t("editProfileLastNameLabel")} htmlFor="edit-person-last-name">
                    <Input id="edit-person-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </FormField>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label={t("editProfileCountryLabel")} htmlFor="edit-person-country" error={err("countryCode")}>
                    <CountrySelect
                      id="edit-person-country"
                      value={countryCode}
                      onChange={setCountryCode}
                      placeholder={t("createPersonCountryPlaceholder")}
                      clearLabel={t("createPersonCountryClear")}
                      invalid={!!fieldErrors.countryCode}
                    />
                  </FormField>
                  <FormField label={t("editProfilePronounsLabel")} htmlFor="edit-person-pronouns" error={err("pronouns")}>
                    <Select
                      items={{ none: t("editProfilePronounsNone"), [PRONOUN_VALUES[0]]: t("editProfilePronounFeminine"), [PRONOUN_VALUES[1]]: t("editProfilePronounMasculine"), [PRONOUN_VALUES[2]]: t("editProfilePronounNeutral") }}
                      value={pronouns || "none"}
                      onValueChange={(v) => setPronouns(v && v !== "none" ? v : "")}
                    >
                      <SelectTrigger id="edit-person-pronouns" aria-invalid={!!fieldErrors.pronouns} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("editProfilePronounsNone")}</SelectItem>
                        <SelectItem value={PRONOUN_VALUES[0]}>{t("editProfilePronounFeminine")}</SelectItem>
                        <SelectItem value={PRONOUN_VALUES[1]}>{t("editProfilePronounMasculine")}</SelectItem>
                        <SelectItem value={PRONOUN_VALUES[2]}>{t("editProfilePronounNeutral")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t pt-4">
                <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{t("editProfileAdvancedSection")}</p>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label={t("editProfileVlrIdLabel")} htmlFor="edit-person-vlr-id" error={err("vlrId")}>
                    <Input id="edit-person-vlr-id" inputMode="numeric" value={vlrId} onChange={(e) => setVlrId(e.target.value)} aria-invalid={!!fieldErrors.vlrId} />
                  </FormField>
                  <FormField label={t("editProfileLiquipediaLabel")} htmlFor="edit-person-liquipedia" error={err("liquipediaLink")}>
                    <Input id="edit-person-liquipedia" value={liquipediaLink} onChange={(e) => setLiquipediaLink(e.target.value)} aria-invalid={!!fieldErrors.liquipediaLink} />
                  </FormField>
                </div>

                <FormField label={t("editProfileAliasesLabel")} htmlFor="edit-person-aliases">
                  <TagsInput
                    value={aliases}
                    onChange={setAliases}
                    placeholder={t("editProfileAliasesPlaceholder")}
                    addLabel={t("editProfileAliasesAdd")}
                    emptyLabel={t("editProfileAliasesEmpty")}
                    removeLabel={t("editProfileAliasesRemove")}
                  />
                </FormField>

                <div className="grid grid-cols-2 gap-3">
                  {PERSON_SOCIAL_KEYS.map((key) => (
                    <FormField
                      key={key}
                      label={t(`socialLabels.${key}`)}
                      htmlFor={`edit-person-social-${key}`}
                      hint={key === "discord" ? t("discordIdHint") : undefined}
                      error={fieldErrors.socials?.[key] ? t(`error.${fieldErrors.socials[key]}` as "error.invalid") : undefined}
                    >
                      <Input
                        id={`edit-person-social-${key}`}
                        inputMode={key === "discord" ? "numeric" : undefined}
                        value={socials[key] ?? ""}
                        onChange={(e) => setSocials((prev) => ({ ...prev, [key]: e.target.value }))}
                        aria-invalid={!!fieldErrors.socials?.[key]}
                      />
                    </FormField>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              {t("createPersonCancel")}
            </Button>
            <Button onClick={handleSave} disabled={isPending || loading}>
              {isPending ? t("editProfileSaving") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

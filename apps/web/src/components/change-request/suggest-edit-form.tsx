/**
 * GC-Stats - suggest-edit-form
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { submitChangeRequest, type ChangeRequestFieldErrors } from "@/actions/change-requests";
import {
  fieldsForSubject,
  readFieldValue,
  readBooleanValue,
  readTagsValue,
  readSelectValue,
  type ChangeRequestFieldDef,
  type ChangeRequestSubjectType,
  type MembershipOperation,
  type NameHistoryOperation,
  type LogoOperation,
} from "@/lib/change-request-fields";
import { PublicCountrySelect } from "@/components/forms/public-country-select";
import { PublicSelect } from "@/components/forms/public-select";
import { PublicTagsInput } from "@/components/forms/public-tags-input";
import { LogoChangeSection } from "@/components/change-request/logo-change-section";
import { MembershipHistorySection, type MembershipEntryView } from "@/components/change-request/membership-history-section";
import { TeamNameHistorySection } from "@/components/change-request/team-name-history-section";
import type { AdminLogoEntry } from "@/lib/admin-logos";
import type { TeamNameHistoryEntry } from "@/lib/team-page-data";
import type { UserLinkStatus } from "@/lib/user-link-request";

export type SuggestEditUserLink = { state: UserLinkStatus["state"]; previousHandle: string | null };

const inputClass =
  "w-full rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-3.5 py-2.5 text-[14.5px] text-neutral-50 outline-none transition-colors focus:border-[#e4ae22]/60 aria-[invalid=true]:border-[#e08585]";

/** Same card shape as the other sections (logo/roster/name-history) — mirrors admin's Card, restyled to the public tokens. */
function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-neutral-800 bg-[var(--gcs-surface)] p-6">
      <h2 className="text-[15px] font-semibold text-neutral-50">{title}</h2>
      {children}
    </div>
  );
}

export function SuggestEditForm({
  subjectType,
  subjectId,
  entity,
  backHref,
  entityName,
  logos,
  membershipEntries,
  nameHistory,
  userLink,
  linkedDiscordId,
}: {
  subjectType: ChangeRequestSubjectType;
  subjectId: number;
  entity: Record<string, unknown>;
  backHref: string;
  entityName: string;
  logos: AdminLogoEntry[];
  /** Team roster (mode="team") or the player's team history (mode="person") — same underlying roster_memberships table, cf. MembershipHistorySection. */
  membershipEntries: MembershipEntryView[];
  /** Team subjects only — omit for a person's suggest-edit page. */
  nameHistory?: TeamNameHistoryEntry[];
  /** Person subjects only: whether the current user can request a link to this player. */
  userLink?: SuggestEditUserLink;
  /** Discord account linked to the viewer's own user account, offered as a one click fill for the Discord field. */
  linkedDiscordId?: string | null;
}) {
  const t = useTranslations("suggestEdit");
  const fields = fieldsForSubject(subjectType);
  const textLikeFields = fields.filter((f) => f.type === "text" || f.type === "textarea" || f.type === "url" || f.type === "discordId" || f.type === "country" || f.type === "select");
  const booleanFields = fields.filter((f) => f.type === "boolean");
  const tagsFields = fields.filter((f) => f.type === "tags");
  const socialFields = fields.filter((f) => f.key.startsWith("socials."));
  const profileFields = fields.filter((f) => !f.key.startsWith("socials."));

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      textLikeFields.map((f) => [f.key, f.type === "select" ? readSelectValue(entity, f.key) : readFieldValue(entity, f.key)])
    )
  );
  const [booleans, setBooleans] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(booleanFields.map((f) => [f.key, readBooleanValue(entity, f.key)]))
  );
  const [tagsValues, setTagsValues] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(tagsFields.map((f) => [f.key, readTagsValue(entity, f.key)]))
  );
  const [reason, setReason] = useState("");
  const [linkUser, setLinkUser] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoMeta, setLogoMeta] = useState({ theme: "", since: "", until: "" });
  const [logoOps, setLogoOps] = useState<LogoOperation[]>([]);
  const [membershipOps, setMembershipOps] = useState<MembershipOperation[]>([]);
  const [nameHistoryOps, setNameHistoryOps] = useState<NameHistoryOperation[]>([]);
  const [fieldErrors, setFieldErrors] = useState<ChangeRequestFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [submittedId, setSubmittedId] = useState<number | null>(null);

  function setValue(key: string, val: string) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);
    setPending(true);

    const formData = new FormData();
    for (const def of textLikeFields) formData.set(def.key, values[def.key] ?? "");
    for (const def of booleanFields) formData.set(def.key, String(booleans[def.key] ?? false));
    for (const def of tagsFields) formData.set(def.key, JSON.stringify(tagsValues[def.key] ?? []));
    formData.set("reason", reason);
    formData.set("membershipOperations", JSON.stringify(membershipOps));
    if (subjectType === "team") formData.set("nameHistoryOperations", JSON.stringify(nameHistoryOps));
    formData.set("logoOperations", JSON.stringify(logoOps));
    if (userLink?.state === "available") formData.set("linkUser", String(linkUser));
    if (logoFile) {
      formData.set("logoFile", logoFile);
      formData.set("logoTheme", logoMeta.theme);
      formData.set("logoSince", logoMeta.since);
      formData.set("logoUntil", logoMeta.until);
    }

    const result = await submitChangeRequest(subjectType, subjectId, formData);
    setPending(false);

    if (!result.ok) {
      setFieldErrors(result.fieldErrors);
      if (result.formError) setFormError(result.formError);
      return;
    }
    setSubmittedId(result.changeRequestId);
  }

  if (submittedId !== null) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-[var(--gcs-surface)] p-7 text-center">
        <p className="mb-1 text-[15px] font-semibold text-[#7cc48a]">{t("success")}</p>
        <p className="mb-5 text-[13.5px] text-neutral-400">{t("successHint")}</p>
        <Link href={backHref} className="inline-block rounded-[9px] bg-[#e4ae22] px-4 py-2.5 text-[14px] font-semibold text-[#0e0e0e] transition-colors hover:bg-[#c9981d]">
          {t("backToPage")}
        </Link>
      </div>
    );
  }

  function renderField(def: ChangeRequestFieldDef, span2 = false) {
    const error = fieldErrors[def.key];
    const label = (
      <span className="flex items-center gap-1 text-[13px] text-neutral-400">
        {t(`field.${def.labelKey}`)}
        {def.required && <span className="text-[#e08585]">*</span>}
      </span>
    );

    if (def.type === "boolean") {
      return (
        <label key={def.key} className="flex items-center gap-2.5 text-[14px] text-neutral-200">
          <input
            type="checkbox"
            checked={booleans[def.key] ?? false}
            onChange={(e) => setBooleans((prev) => ({ ...prev, [def.key]: e.target.checked }))}
            className="h-4 w-4 accent-[#e4ae22]"
          />
          {t(`field.${def.labelKey}`)}
        </label>
      );
    }

    if (def.type === "tags") {
      return (
        <div key={def.key} className={`flex flex-col gap-1.5 ${span2 ? "sm:col-span-2" : ""}`}>
          {label}
          <PublicTagsInput
            value={tagsValues[def.key] ?? []}
            onChange={(v) => setTagsValues((prev) => ({ ...prev, [def.key]: v }))}
            placeholder={t(`field.${def.labelKey}Placeholder`)}
            addLabel={t("addTag")}
            maxItems={def.maxItems ?? 20}
          />
          {error && <span className="text-[12px] text-[#e08585]">{t(`error.${error}`)}</span>}
        </div>
      );
    }

    if (def.type === "select") {
      return (
        <div key={def.key} className="flex flex-col gap-1.5">
          {label}
          <PublicSelect
            value={values[def.key] ?? ""}
            onChange={(v) => setValue(def.key, v)}
            options={(def.options ?? []).map((o) => ({
              value: o,
              label: o === "" ? t(`field.${def.labelKey}None`) : t(`field.${def.labelKey}Option.${o}`),
            }))}
          />
          {error && <span className="text-[12px] text-[#e08585]">{t(`error.${error}`)}</span>}
        </div>
      );
    }

    if (def.type === "country") {
      return (
        <label key={def.key} className="flex flex-col gap-1.5">
          {label}
          <PublicCountrySelect
            id={`field-${def.key}`}
            value={values[def.key] ?? ""}
            onChange={(v) => setValue(def.key, v)}
            placeholder={t("countryPlaceholder")}
            clearLabel={t("countryClear")}
            invalid={!!error}
          />
          {error && <span className="text-[12px] text-[#e08585]">{t(`error.${error}`)}</span>}
        </label>
      );
    }

    if (def.type === "discordId") {
      const value = values[def.key] ?? "";
      return (
        <div key={def.key} className="flex flex-col gap-1.5">
          <label htmlFor={`field-${def.key}`}>{label}</label>
          <input
            id={`field-${def.key}`}
            type="text"
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(def.key, e.target.value)}
            aria-invalid={!!error}
            maxLength={def.maxLength}
            className={inputClass}
          />
          <span className="text-[11.5px] text-neutral-500">{t("discordIdHint")}</span>
          {linkedDiscordId && value.trim() !== linkedDiscordId && (
            <button
              type="button"
              onClick={() => setValue(def.key, linkedDiscordId)}
              className="self-start rounded-[8px] border border-neutral-700 bg-white/5 px-3 py-1.5 text-[12.5px] font-semibold text-neutral-200 transition-all hover:border-[#5865F2] hover:text-[#8f99f7] active:scale-[0.97]"
            >
              {t("useLinkedDiscord")}
            </button>
          )}
          {error && <span className="text-[12px] text-[#e08585]">{t(`error.${error}`)}</span>}
        </div>
      );
    }

    if (def.type === "textarea") {
      return (
        <label key={def.key} className={`flex flex-col gap-1.5 ${span2 ? "sm:col-span-2" : ""}`}>
          {label}
          <textarea
            id={`field-${def.key}`}
            value={values[def.key] ?? ""}
            onChange={(e) => setValue(def.key, e.target.value)}
            aria-invalid={!!error}
            rows={4}
            maxLength={def.maxLength}
            className={inputClass}
          />
          {error && <span className="text-[12px] text-[#e08585]">{t(`error.${error}`)}</span>}
        </label>
      );
    }

    return (
      <label key={def.key} className="flex flex-col gap-1.5">
        {label}
        <input
          id={`field-${def.key}`}
          type={def.type === "url" ? "url" : "text"}
          value={values[def.key] ?? ""}
          onChange={(e) => setValue(def.key, e.target.value)}
          aria-invalid={!!error}
          maxLength={def.maxLength}
          className={inputClass}
        />
        {def.type === "url" && <span className="text-[11.5px] text-neutral-500">{t("urlHint")}</span>}
        {error && <span className="text-[12px] text-[#e08585]">{t(`error.${error}`)}</span>}
      </label>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <p className="text-[14.5px] leading-relaxed text-neutral-400">{t("intro", { name: entityName })}</p>

      {/* Same two-column shape as admin's {Team,Player}EditForm — profile fields
          on the left, socials + logo on the right — rather than one long
          single-column form, now that the page has room for it. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
        <SectionCard title={t("sectionProfile")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{profileFields.map((def) => renderField(def, true))}</div>
        </SectionCard>

        <div className="flex flex-col gap-5">
          <SectionCard title={t("sectionSocials")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{socialFields.map((def) => renderField(def))}</div>
          </SectionCard>

          <LogoChangeSection
            logos={logos}
            onFileChange={(file, meta) => {
              setLogoFile(file);
              setLogoMeta(meta);
            }}
            onOperationsChange={setLogoOps}
          />
          {fieldErrors.logo && <span className="text-[12px] text-[#e08585]">{t(`error.${fieldErrors.logo}`)}</span>}
        </div>
      </div>

      {subjectType === "team" && nameHistory && <TeamNameHistorySection entries={nameHistory} onChange={setNameHistoryOps} />}

      <MembershipHistorySection mode={subjectType} fixedId={subjectId} entries={membershipEntries} onChange={setMembershipOps} />

      {userLink && userLink.state !== "notFound" && (
        <SectionCard title={t("userLink.title")}>
          {userLink.state === "available" ? (
            <>
              <label className="flex cursor-pointer items-start gap-2.5 text-[14px] text-neutral-200">
                <input
                  type="checkbox"
                  checked={linkUser}
                  onChange={(e) => setLinkUser(e.target.checked)}
                  aria-invalid={!!fieldErrors.linkUser}
                  className="mt-0.5 h-4 w-4 accent-[#e4ae22]"
                />
                {t("userLink.checkbox", { name: entityName })}
              </label>
              <p className="text-[12.5px] text-neutral-500">{t("userLink.hint")}</p>
              {linkUser && userLink.previousHandle && (
                <p className="text-[12.5px] text-[#e4ae22]">{t("userLink.replaces", { previous: userLink.previousHandle })}</p>
              )}
            </>
          ) : (
            <p className="text-[13.5px] text-neutral-400">{t(`userLink.state.${userLink.state}`)}</p>
          )}
          {fieldErrors.linkUser && <span className="text-[12px] text-[#e08585]">{t(`error.${fieldErrors.linkUser}`)}</span>}
        </SectionCard>
      )}

      <SectionCard title={t("sectionReview")}>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-neutral-400">{t("field.reason")}</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={!!fieldErrors.reason}
            rows={2}
            maxLength={500}
            className={inputClass}
          />
          {fieldErrors.reason && <span className="text-[12px] text-[#e08585]">{t(`error.${fieldErrors.reason}`)}</span>}
        </label>

        {formError && (
          <p role="alert" className="text-[13.5px] text-[#e08585]">
            {t(`error.${formError}`)}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-[9px] bg-[#e4ae22] px-5 py-2.5 text-[14px] font-semibold text-[#0e0e0e] transition-colors hover:bg-[#c9981d] active:bg-[#b3860f] disabled:opacity-60"
          >
            {t("submit")}
          </button>
          <Link href={backHref} className="text-[13.5px] font-medium text-neutral-400 transition-colors hover:text-neutral-200">
            {t("cancel")}
          </Link>
        </div>
      </SectionCard>
    </form>
  );
}

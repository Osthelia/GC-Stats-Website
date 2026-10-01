/**
 * GC-Stats - profile-settings-form
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { updateMyProfile, getTeamFanTags, type MyProfile } from "@/actions/user-profile";
import { USER_SOCIAL_KEYS, PRONOUN_OPTIONS, type UserProfileFieldErrors } from "@/lib/user-profile-validation";
import { DiscordIcon, TwitchIcon, XIcon, InstagramIcon, YoutubeIcon, TiktokIcon } from "@/components/icons/brand-icons";
import { PublicSelect } from "@/components/forms/public-select";
import { PublicEntityPicker } from "@/components/forms/public-entity-picker";
import { SettingsCard } from "./settings-card";

const inputClass =
  "rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-3.5 py-2.5 text-[14.5px] text-neutral-50 outline-none transition-colors focus:border-[#e4ae22]/60 aria-[invalid=true]:border-[#e08585]";

const SOCIAL_META: Record<(typeof USER_SOCIAL_KEYS)[number], { label: string; icon: (props: { className?: string }) => React.ReactNode }> = {
  twitter: { label: "Twitter / X", icon: XIcon },
  twitch: { label: "Twitch", icon: TwitchIcon },
  instagram: { label: "Instagram", icon: InstagramIcon },
  youtube: { label: "YouTube", icon: YoutubeIcon },
  tiktok: { label: "TikTok", icon: TiktokIcon },
  discord: { label: "Discord", icon: DiscordIcon },
};

export function ProfileSettingsForm({ profile }: { profile: MyProfile }) {
  const t = useTranslations("accountSettings.profile");
  const { update } = useSession();
  const router = useRouter();

  const [name, setName] = useState(profile.name);
  const [username, setUsername] = useState(profile.username);
  const [pronouns, setPronouns] = useState(profile.pronouns);
  const [bio, setBio] = useState(profile.bio);
  const [team, setTeam] = useState<{ id: number; label: string } | null>(profile.team ? { id: profile.team.id, label: profile.team.name } : null);
  const [teamTags, setTeamTags] = useState<string[]>(profile.team?.tags ?? []);
  const [teamTag, setTeamTag] = useState(profile.teamTag);
  const [socials, setSocials] = useState<Record<string, string>>(profile.socials);
  const [fieldErrors, setFieldErrors] = useState<UserProfileFieldErrors>({});
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleTeamChange(entity: { id: number; label: string } | null) {
    setTeam(entity);
    setTeamTag("");
    setTeamTags(entity ? await getTeamFanTags(entity.id) : []);
  }

  const err = (field: string) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}`) : undefined);

  const pronounOptions = [
    { value: "", label: t("pronounsNone") },
    ...PRONOUN_OPTIONS.map((p) => ({ value: String(p), label: t(`pronounsOption.${p}`) })),
  ];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setStatus(null);
    setPending(true);

    const result = await updateMyProfile({ name, username, pronouns, bio, teamId: team?.id ?? null, teamTag, socials });
    setPending(false);

    if (!result.ok) {
      setFieldErrors(result.fieldErrors);
      return;
    }

    if (result.username !== profile.username) {
      await update({ username: result.username });
      router.replace(`/user/${result.username}`);
      return;
    }

    setStatus(t("success"));
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <SettingsCard heading={t("mainHeading")} description={t("mainDescription")}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-[13px] text-neutral-400">
              <span className="flex items-center gap-1">
                {t("nameLabel")}
                <span className="text-[#e08585]">*</span>
              </span>
              <input value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!fieldErrors.name} maxLength={255} className={inputClass} />
              {err("name") && <span className="text-[12px] text-[#e08585]">{err("name")}</span>}
            </label>

            <label className="flex flex-col gap-1.5 text-[13px] text-neutral-400">
              <span className="flex items-center gap-1">
                {t("usernameLabel")}
                <span className="text-[#e08585]">*</span>
              </span>
              <input value={username} onChange={(e) => setUsername(e.target.value)} aria-invalid={!!fieldErrors.username} maxLength={32} className={inputClass} />
              {err("username") ? (
                <span className="text-[12px] text-[#e08585]">{err("username")}</span>
              ) : (
                <span className="text-[11.5px] text-neutral-500">{t("usernameHint")}</span>
              )}
            </label>
          </div>

          <label className="flex max-w-[280px] flex-col gap-1.5 text-[13px] text-neutral-400">
            {t("pronounsLabel")}
            <PublicSelect value={pronouns} onChange={setPronouns} options={pronounOptions} />
            {err("pronouns") && <span className="text-[12px] text-[#e08585]">{err("pronouns")}</span>}
          </label>

          <div className="flex flex-col gap-1.5 text-[13px] text-neutral-400">
            {t("teamLabel")}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <PublicEntityPicker
                  type="team"
                  value={team}
                  onChange={handleTeamChange}
                  placeholder={t("teamPlaceholder")}
                  searchPlaceholder={t("teamSearchPlaceholder")}
                  noResultsLabel={t("teamSearchEmpty")}
                />
              </div>
              {team && (
                <button
                  type="button"
                  onClick={() => handleTeamChange(null)}
                  className="flex-none rounded-[9px] px-3 py-2 text-[13px] font-medium text-[#e08585] transition-colors hover:bg-[#e08585]/10"
                >
                  {t("teamRemove")}
                </button>
              )}
            </div>

            {team &&
              (teamTags.length > 0 ? (
                <label className="mt-1 flex max-w-[280px] flex-col gap-1.5">
                  <span>{t("teamTagLabel")}</span>
                  <PublicSelect value={teamTag} onChange={setTeamTag} options={[{ value: "", label: t("teamTagNone") }, ...teamTags.map((tag) => ({ value: tag, label: tag }))]} />
                </label>
              ) : (
                <p className="mt-1 text-[11.5px] text-neutral-500">{t("teamNoTags")}</p>
              ))}
            {err("teamTag") && <span className="text-[12px] text-[#e08585]">{err("teamTag")}</span>}
          </div>

          <label className="flex flex-col gap-1.5 text-[13px] text-neutral-400">
            {t("bioLabel")}
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              aria-invalid={!!fieldErrors.bio}
              rows={4}
              maxLength={2000}
              className={inputClass}
            />
            {err("bio") && <span className="text-[12px] text-[#e08585]">{err("bio")}</span>}
          </label>
        </div>
      </SettingsCard>

      <SettingsCard heading={t("socialsHeading")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {USER_SOCIAL_KEYS.map((key) => {
            const meta = SOCIAL_META[key];
            const Icon = meta.icon;
            const errorKey = `socials.${key}`;
            return (
              <label key={key} className="flex flex-col gap-1.5 text-[13px] text-neutral-400">
                <span className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5" />
                  {meta.label}
                </span>
                <input
                  type="url"
                  value={socials[key] ?? ""}
                  onChange={(e) => setSocials((prev) => ({ ...prev, [key]: e.target.value }))}
                  aria-invalid={!!fieldErrors[errorKey]}
                  placeholder="https://"
                  className={inputClass}
                />
                {fieldErrors[errorKey] && <span className="text-[12px] text-[#e08585]">{t(`error.${fieldErrors[errorKey]}`)}</span>}
              </label>
            );
          })}
        </div>
      </SettingsCard>

      {status && <p className="text-[13px] text-[#7cc48a]">{status}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[9px] bg-[#e4ae22] px-5 py-2.5 text-[14px] font-semibold text-[#0e0e0e] transition-colors hover:bg-[#c9981d] active:bg-[#b3860f] disabled:opacity-60"
        >
          {t("save")}
        </button>
      </div>
    </form>
  );
}

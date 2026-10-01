/**
 * GC-Stats - change-request-value
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";

const PRONOUN_KEYS: Record<string, "0" | "1" | "2"> = { "0": "0", "1": "1", "2": "2" };

/**
 * Read-only port of components/admin/change-request-item-value.tsx for the
 * public "my change requests" thread (same field vocabulary), with no admin
 * component import: admin and public components stay separate.
 */
export function ChangeRequestValue({ field, value, display, side }: { field: string; value: unknown; display: { personName?: string; teamName?: string; logoPreviewUrl?: string | null; username?: string }; side: "old" | "new" }) {
  const t = useTranslations("accountSettings.changeRequests.detail");
  const tField = useTranslations("suggestEdit.field");

  if (field === "isActive") {
    if (value === null || value === undefined) return <span className="text-neutral-500">{t("noValue")}</span>;
    return <span>{value ? t("yes") : t("no")}</span>;
  }

  if (field === "tags" || field === "aliases") {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    if (arr.length === 0) return <span className="text-neutral-500">{t("noValue")}</span>;
    return <span>{arr.join(", ")}</span>;
  }

  if (field === "pronouns") {
    if (value === null || value === undefined || value === "") return <span className="text-neutral-500">{tField("pronounsNone")}</span>;
    const key = PRONOUN_KEYS[String(value)];
    return <span>{key ? tField(`pronounsOption.${key}`) : String(value)}</span>;
  }

  if (field === "roster") {
    if (side === "old") {
      const v = value as { team_id: number; team_name: string } | null;
      if (!v) return <span className="text-neutral-500">{t("noValue")}</span>;
      return <span>{v.team_name}</span>;
    }
    const v = value as { role: string; team_id: number; joined_at: string; team_name: string } | null;
    if (!v) return <span className="text-neutral-500">{t("noValue")}</span>;
    return (
      <div className="flex flex-col text-[13px]">
        <span className="font-medium">{v.team_name}</span>
        <span className="text-neutral-500">
          {v.role} · {v.joined_at}
        </span>
      </div>
    );
  }

  if (field === "membership_add" || field === "membership_edit") {
    if (side === "old" && field === "membership_add") return <span className="text-neutral-500">{t("noValue")}</span>;
    const v = value as { role: string; since: string; until: string | null; inactiveSince: string | null } | null;
    if (!v) return <span className="text-neutral-500">{t("noValue")}</span>;
    return (
      <div className="flex flex-col text-[13px]">
        {(display.personName || display.teamName) && (
          <span className="font-medium">
            {display.personName} · {display.teamName}
          </span>
        )}
        <span>{v.role}</span>
        <span className="text-neutral-500">
          {v.since} → {v.until ?? "…"}
        </span>
        {v.inactiveSince && <span className="text-neutral-500">{t("inactiveSince", { date: v.inactiveSince })}</span>}
      </div>
    );
  }

  if (field === "membership_delete") {
    if (side === "new") return <span className="text-neutral-500">{t("noValue")}</span>;
    return (
      <div className="flex flex-col text-[13px]">
        {(display.personName || display.teamName) && (
          <span className="font-medium">
            {display.personName} · {display.teamName}
          </span>
        )}
      </div>
    );
  }

  if (field === "name_history_add") {
    if (side === "old") return <span className="text-neutral-500">{t("noValue")}</span>;
    const v = value as { name: string; since: string; until: string | null };
    return (
      <span>
        {v.name} ({v.since} → {v.until ?? "…"})
      </span>
    );
  }
  if (field === "name_history_toggle") {
    const v = value as { isVisible?: boolean } | null;
    if (!v || v.isVisible === undefined) return <span className="text-neutral-500">{t("noValue")}</span>;
    return <span>{v.isVisible ? t("yes") : t("no")}</span>;
  }
  if (field === "name_history_delete") {
    if (side === "new") return <span className="text-neutral-500">{t("noValue")}</span>;
    return <span className="text-neutral-500">#{(value as { id: number }).id}</span>;
  }

  if (field === "user_link") {
    if (side === "old") {
      const v = value as { previousPersonId: number | null } | null;
      if (!v?.previousPersonId) return <span className="text-neutral-500">{t("noValue")}</span>;
      return <span>{display.personName}</span>;
    }
    return <span className="font-medium">{display.username}</span>;
  }

  if (field === "logo" || field === "logo_edit" || field === "logo_delete") {
    const isThisSide = (field === "logo" && side === "new") || (field === "logo_edit" && side === "new") || (field === "logo_delete" && side === "old");
    if (!isThisSide) return <span className="text-neutral-500">{t("noValue")}</span>;
    if (!display.logoPreviewUrl) return <span className="text-neutral-500">{t("noValue")}</span>;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={display.logoPreviewUrl} alt="" className="h-12 w-12 rounded-md border border-neutral-800 object-cover" />;
  }

  if (value === null || value === undefined || value === "") return <span className="text-neutral-500">{t("noValue")}</span>;
  return <span className="break-words">{String(value)}</span>;
}

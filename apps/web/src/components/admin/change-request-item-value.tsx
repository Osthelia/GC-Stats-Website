/**
 * GC-Stats - change-request-item-value
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useTranslations } from "next-intl";

const PRONOUN_KEYS: Record<string, "0" | "1" | "2"> = { "0": "0", "1": "1", "2": "2" };

/** Renders one field's old/new value for the review UI — same field vocabulary as change-request-fields.ts, plus the structural ops (membership_*, name_history_*, logo*) which don't map to a single scalar. */
export function ChangeRequestValue({ field, value, display, side }: { field: string; value: unknown; display: { personName?: string; teamName?: string; logoPreviewUrl?: string | null; username?: string }; side: "old" | "new" }) {
  const t = useTranslations("admin.changeRequests.detail");
  const tField = useTranslations("suggestEdit.field");

  if (field === "isActive") {
    if (value === null || value === undefined) return <span className="text-muted-foreground">{t("noValue")}</span>;
    return <span>{value ? t("yes") : t("no")}</span>;
  }

  if (field === "tags" || field === "aliases") {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    if (arr.length === 0) return <span className="text-muted-foreground">{t("noValue")}</span>;
    return <span>{arr.join(", ")}</span>;
  }

  if (field === "pronouns") {
    if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">{tField("pronounsNone")}</span>;
    const key = PRONOUN_KEYS[String(value)];
    return <span>{key ? tField(`pronounsOption.${key}` as "pronounsOption.0") : String(value)}</span>;
  }

  if (field === "roster") {
    if (side === "old") {
      const v = value as { team_id: number; team_name: string } | null;
      if (!v) return <span className="text-muted-foreground">{t("noValue")}</span>;
      return <span>{v.team_name}</span>;
    }
    const v = value as { role: string; team_id: number; joined_at: string; team_name: string } | null;
    if (!v) return <span className="text-muted-foreground">{t("noValue")}</span>;
    return (
      <div className="flex flex-col text-sm">
        <span className="font-medium">{v.team_name}</span>
        <span className="text-muted-foreground">
          {v.role} · {v.joined_at}
        </span>
      </div>
    );
  }

  if (field === "membership_add" || field === "membership_edit") {
    if (side === "old" && field === "membership_add") return <span className="text-muted-foreground">{t("noValue")}</span>;
    const v = value as { role: string; since: string; until: string | null; inactiveSince: string | null } | null;
    if (!v) return <span className="text-muted-foreground">{t("noValue")}</span>;
    return (
      <div className="flex flex-col text-sm">
        {(display.personName || display.teamName) && (
          <span className="font-medium">
            {display.personName} · {display.teamName}
          </span>
        )}
        <span>{v.role}</span>
        <span className="text-muted-foreground">
          {v.since} → {v.until ?? "…"}
        </span>
        {v.inactiveSince && <span className="text-muted-foreground">{t("inactiveSince", { date: v.inactiveSince })}</span>}
      </div>
    );
  }

  if (field === "membership_delete") {
    if (side === "new") return <span className="text-muted-foreground">{t("noValue")}</span>;
    return (
      <div className="flex flex-col text-sm">
        {(display.personName || display.teamName) && (
          <span className="font-medium">
            {display.personName} · {display.teamName}
          </span>
        )}
      </div>
    );
  }

  if (field === "name_history_add") {
    if (side === "old") return <span className="text-muted-foreground">{t("noValue")}</span>;
    const v = value as { name: string; since: string; until: string | null };
    return (
      <span>
        {v.name} ({v.since} → {v.until ?? "…"})
      </span>
    );
  }
  if (field === "name_history_toggle") {
    const v = value as { isVisible?: boolean } | null;
    if (!v || v.isVisible === undefined) return <span className="text-muted-foreground">{t("noValue")}</span>;
    return <span>{v.isVisible ? t("yes") : t("no")}</span>;
  }
  if (field === "name_history_delete") {
    if (side === "new") return <span className="text-muted-foreground">{t("noValue")}</span>;
    return <span className="text-muted-foreground">#{(value as { id: number }).id}</span>;
  }

  if (field === "user_link") {
    if (side === "old") {
      const v = value as { previousPersonId: number | null } | null;
      if (!v?.previousPersonId) return <span className="text-muted-foreground">{t("noValue")}</span>;
      return <span>{display.personName}</span>;
    }
    return <span className="font-medium">{display.username}</span>;
  }

  if (field === "logo" || field === "logo_edit" || field === "logo_delete") {
    const isThisSide = (field === "logo" && side === "new") || (field === "logo_edit" && side === "new") || (field === "logo_delete" && side === "old");
    if (!isThisSide) return <span className="text-muted-foreground">{t("noValue")}</span>;
    if (!display.logoPreviewUrl) return <span className="text-muted-foreground">{t("noValue")}</span>;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={display.logoPreviewUrl} alt="" className="size-12 rounded-md border object-cover" />;
  }

  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">{t("noValue")}</span>;
  return <span className="break-words">{String(value)}</span>;
}

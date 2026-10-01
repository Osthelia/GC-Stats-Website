/**
 * GC-Stats - change-request-items-readonly
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import { ChangeRequestValue } from "./change-request-value";
import type { AdminChangeRequestItem } from "@/lib/admin-change-requests";

const STRUCTURAL_FIELDS = new Set(["membership_add", "membership_edit", "membership_delete", "name_history_add", "name_history_toggle", "name_history_delete", "logo", "logo_edit", "logo_delete", "roster", "user_link"]);

const STATUS_STYLES: Record<AdminChangeRequestItem["status"], string> = {
  pending: "border-amber-400/30 bg-amber-400/5",
  approved: "border-emerald-400/30 bg-emerald-400/5",
  rejected: "border-[#e08585]/30 bg-[#e08585]/5",
  failed: "border-[#e08585]/30 bg-[#e08585]/5",
};

export function ChangeRequestItemsReadonly({ items }: { items: AdminChangeRequestItem[] }) {
  const t = useTranslations("accountSettings.changeRequests.detail");
  const tField = useTranslations("suggestEdit.field");

  function fieldLabel(field: string): string {
    if (field.startsWith("socials.")) return tField(field.slice("socials.".length));
    if (STRUCTURAL_FIELDS.has(field)) return t(`field.${field}`);
    return tField(field);
  }

  const statusLabel = (status: AdminChangeRequestItem["status"]) =>
    status === "pending" ? t("itemStatusPending") : status === "approved" ? t("itemStatusApproved") : status === "rejected" ? t("itemStatusRejected") : t("itemStatusFailed");

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.id} className={`flex flex-col gap-3 rounded-xl border p-4 ${STATUS_STYLES[item.status]}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13.5px] font-semibold text-neutral-100">{fieldLabel(item.field)}</span>
            <span className="text-[12px] text-neutral-500">{statusLabel(item.status)}</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="text-[11.5px] text-neutral-500">{t("oldValue")}</span>
              <ChangeRequestValue field={item.field} value={item.oldValue} display={item.display} side="old" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11.5px] text-neutral-500">{t("newValue")}</span>
              <ChangeRequestValue field={item.field} value={item.newValue} display={item.display} side="new" />
            </div>
          </div>

          {item.status === "failed" && item.applyError && <p className="text-[13px] text-[#e08585]">{t("applyError", { error: item.applyError })}</p>}

          {item.status !== "pending" && item.resolutionNote && <p className="text-[12px] text-neutral-500">{item.resolutionNote}</p>}
        </div>
      ))}
    </div>
  );
}

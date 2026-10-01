/**
 * GC-Stats - change-request-item-card
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { resolveChangeRequestItem } from "@/actions/admin-change-requests";
import { ChangeRequestValue } from "@/components/admin/change-request-item-value";
import type { AdminChangeRequestItem } from "@/lib/admin-change-requests";

const STRUCTURAL_FIELDS = new Set([
  "membership_add",
  "membership_edit",
  "membership_delete",
  "name_history_add",
  "name_history_toggle",
  "name_history_delete",
  "logo",
  "logo_edit",
  "logo_delete",
  // Not produced by the public suggest-edit form (that's membership_add/edit/delete
  // above) — "roster" is a second, separate producer: an automated roster-mismatch
  // detector that runs during stat ingestion (found live in prod data, not in this
  // repo's code — likely a standalone script writing straight to the shared DB).
  // Shape: oldValue {team_id, team_name}|null, newValue {role, team_id, joined_at, team_name}.
  "roster",
  // Account <-> player link requested via the OAuth "link_player" scope
  // (app/api/oauth/link-player/route.ts). oldValue {previousPersonId}, newValue {userId, previousPersonId}.
  "user_link",
]);

/**
 * Field labels are dynamic (driven by the stored `field` string, not a
 * fixed literal), so next-intl's key-typing is cast away here — same
 * pattern already used for role labels in admin/team-roster-panel.tsx.
 */
function fieldLabel(field: string, tField: ReturnType<typeof useTranslations>, tDetail: ReturnType<typeof useTranslations>): string {
  if (field.startsWith("socials.")) {
    const key = field.slice("socials.".length);
    return tField(key as "twitter");
  }
  if (STRUCTURAL_FIELDS.has(field)) {
    return tDetail(`field.${field}` as "field.logo");
  }
  return tField(field as "handle");
}

const STATUS_STYLES: Record<AdminChangeRequestItem["status"], string> = {
  pending: "border-amber-400/30 bg-amber-400/5",
  approved: "border-emerald-400/30 bg-emerald-400/5",
  rejected: "border-destructive/30 bg-destructive/5",
  failed: "border-destructive/30 bg-destructive/5",
};

export function ChangeRequestItemCard({ item, canManage, onResolved }: { item: AdminChangeRequestItem; canManage: boolean; onResolved: (updated: AdminChangeRequestItem) => void }) {
  const t = useTranslations("admin.changeRequests.detail");
  const tField = useTranslations("suggestEdit.field");
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  function resolve(action: "approve" | "reject") {
    startTransition(async () => {
      const result = await resolveChangeRequestItem(item.id, action, note);
      if (!result.ok) {
        toast.error(t("actionError"));
        return;
      }
      onResolved({ ...item, status: result.status, applyError: result.applyError, resolutionNote: note.trim() || null });
      toast.success(t("actionSuccess"));
    });
  }

  const statusLabel =
    item.status === "pending" ? t("itemStatusPending") : item.status === "approved" ? t("itemStatusApproved") : item.status === "rejected" ? t("itemStatusRejected") : t("itemStatusFailed");

  return (
    <div className={`flex flex-col gap-2 rounded-lg border p-3 ${STATUS_STYLES[item.status]}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{fieldLabel(item.field, tField, t)}</span>
        <span className="text-xs text-muted-foreground">{statusLabel}</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-0.5 overflow-hidden">
          <span className="text-xs text-muted-foreground">{t("oldValue")}</span>
          <ChangeRequestValue field={item.field} value={item.oldValue} display={item.display} side="old" />
        </div>
        <div className="flex flex-col gap-0.5 overflow-hidden">
          <span className="text-xs text-muted-foreground">{t("newValue")}</span>
          <ChangeRequestValue field={item.field} value={item.newValue} display={item.display} side="new" />
        </div>
      </div>

      {item.status === "failed" && item.applyError && (
        <p className="text-sm text-destructive">
          {t("applyError", { error: t.has(`applyErrorCode.${item.applyError}`) ? t(`applyErrorCode.${item.applyError}` as "applyErrorCode.unknown") : item.applyError })}
        </p>
      )}

      {item.status !== "pending" && (
        <p className="text-xs text-muted-foreground">
          {item.resolvedByUsername ? t("resolvedBy", { username: item.resolvedByUsername }) : t("resolvedByUnknown")}
          {item.resolutionNote ? ` · ${item.resolutionNote}` : ""}
        </p>
      )}

      {item.status === "pending" && canManage && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("notePlaceholder")} className="min-h-9 flex-1" rows={1} />
          <div className="flex shrink-0 gap-2">
            <Button size="sm" disabled={isPending} onClick={() => resolve("approve")}>
              {t("approve")}
            </Button>
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => resolve("reject")} className="text-destructive hover:text-destructive">
              {t("reject")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

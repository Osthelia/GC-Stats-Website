/**
 * GC-Stats - change-request-detail-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ChangeRequestStatusBadge } from "@/components/admin/change-request-status-badge";
import { ChangeRequestItemCard } from "@/components/admin/change-request-item-card";
import { AdminChangeRequestMessageThread } from "@/components/admin/change-request-message-thread";
import { resolveAllPendingItems } from "@/actions/admin-change-requests";
import type { AdminChangeRequestDetail, AdminChangeRequestItem, ChangeRequestStatus } from "@/lib/admin-change-requests";
import type { ChangeRequestMessageRow } from "@/lib/change-request-messages";

function overallStatus(items: AdminChangeRequestItem[]): ChangeRequestStatus {
  if (items.some((i) => i.status === "pending")) return "pending";
  const approvedCount = items.filter((i) => i.status === "approved").length;
  if (approvedCount === 0) return "rejected";
  if (approvedCount === items.length) return "approved";
  return "partial";
}

/**
 * Client-driven review UI — each item resolves independently (no full page
 * reload per accept/reject, per CLAUDE.md/SUIVI.MD's explicit ask for this
 * page), with local state tracking status so the header badge and the
 * bulk-action buttons stay in sync without a router.refresh().
 */
export function ChangeRequestDetailPanel({ detail, canManage, messages }: { detail: AdminChangeRequestDetail; canManage: boolean; messages: ChangeRequestMessageRow[] }) {
  const t = useTranslations("admin.changeRequests.detail");
  const [items, setItems] = useState(detail.items);
  const [isPending, startTransition] = useTransition();
  const [bulkAction, setBulkAction] = useState<"approve" | "reject" | null>(null);
  const [bulkNote, setBulkNote] = useState("");

  // "withdrawn" is set externally (see admin-change-requests.ts) and never
  // produced by resolving items here — once a request loads as withdrawn it
  // stays withdrawn regardless of the (already fully-resolved) items below.
  const status = useMemo(() => (detail.status === "withdrawn" ? "withdrawn" : overallStatus(items)), [items, detail.status]);
  const pendingCount = items.filter((i) => i.status === "pending").length;

  function handleResolved(updated: AdminChangeRequestItem) {
    setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
  }

  function bulkResolve(action: "approve" | "reject") {
    const note = bulkNote;
    startTransition(async () => {
      const results = await resolveAllPendingItems(detail.id, action, note);
      setItems((prev) =>
        prev.map((it) => {
          const match = results.find((r) => r.itemId === it.id);
          if (!match || !match.result.ok) return it;
          return { ...it, status: match.result.status, applyError: match.result.applyError, resolutionNote: note.trim() || null };
        })
      );
      setBulkNote("");
      toast.success(t("actionSuccess"));
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <ChangeRequestStatusBadge status={status} />
          {canManage && pendingCount > 1 && (
            <div className="flex gap-2">
              <Button size="sm" disabled={isPending} onClick={() => setBulkAction("approve")}>
                {t("approveAll")}
              </Button>
              <Button size="sm" variant="outline" disabled={isPending} onClick={() => setBulkAction("reject")} className="text-destructive hover:text-destructive">
                {t("rejectAll")}
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <ChangeRequestItemCard key={item.id} item={item} canManage={canManage} onResolved={handleResolved} />
          ))}
        </div>
      </div>

      <div className="border-t pt-4 lg:sticky lg:top-4 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
        <AdminChangeRequestMessageThread changeRequestId={detail.id} messages={messages} canPost={canManage && detail.status === "pending"} />
      </div>

      <ConfirmDialog
        open={bulkAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setBulkAction(null);
            setBulkNote("");
          }
        }}
        title={t("bulkConfirmTitle")}
        description={bulkAction === "approve" ? t("bulkConfirmApprove") : t("bulkConfirmReject")}
        confirmLabel={bulkAction === "approve" ? t("approveAll") : t("rejectAll")}
        cancelLabel={t("cancel")}
        onConfirm={() => {
          if (bulkAction) bulkResolve(bulkAction);
          setBulkAction(null);
        }}
        isPending={isPending}
        destructive={bulkAction === "reject"}
      >
        <Textarea value={bulkNote} onChange={(e) => setBulkNote(e.target.value)} placeholder={t("notePlaceholder")} className="min-h-16" />
      </ConfirmDialog>
    </div>
  );
}

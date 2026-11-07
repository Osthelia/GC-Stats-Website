/**
 * GC-Stats - team-requests-table
 *
 * In progress and done tabs: tracked requests with their message, contact
 * and the button moving them between the two states.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, CheckCircle2, ChevronDown, Copy, ExternalLink, Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminEntityLogo } from "@/components/admin/admin-entity-logo";
import { setTeamRequestStatus } from "@/actions/admin-team-requests";
import { contactHref } from "@/lib/team-requests/contact";
import type { TeamRequestRow } from "@/lib/admin-team-requests";

function RequestRow({ row, canManage }: { row: TeamRequestRow; canManage: boolean }) {
  const t = useTranslations("admin.teamRequests.table");
  const tSocial = useTranslations("admin.teamRequests.socials");
  const tBuilder = useTranslations("admin.teamRequests.builder");
  const tError = useTranslations("admin.teamRequests.error");
  const format = useFormatter();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const itemLabel = (item: string) => (item === "logo" ? tBuilder("logo") : item === "roster" ? tBuilder("roster") : tSocial(item));
  const href = contactHref(row.contactChannel, row.contactValue);
  const nextStatus = row.status === "pending" ? "done" : "pending";

  function changeStatus() {
    startTransition(async () => {
      const result = await setTeamRequestStatus(row.id, nextStatus);
      if (!result.ok) {
        toast.error(tError(result.error));
        return;
      }
      toast.success(t(nextStatus === "done" ? "markedDone" : "reopened"));
      router.refresh();
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(row.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(tBuilder("copyFailed"));
    }
  }

  return (
    <li className="flex flex-col gap-2 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <AdminEntityLogo src={row.teamLogoUrl} alt={row.teamName} sizeClassName="size-9" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{row.teamName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {t("contact", { kind: tBuilder(`kind.${row.contactKind}`), channel: tSocial(row.contactChannel), label: row.contactLabel })}
            {" · "}
            {format.dateTime(new Date(row.completedAt ?? row.createdAt), { dateStyle: "medium" })}
            {row.createdByUsername ? ` · ${row.createdByUsername}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {row.items.map((item) => (
            <Badge key={item} variant="secondary">
              {itemLabel(item)}
            </Badge>
          ))}
        </div>
        {href && (
          <Button variant="outline" size="sm" className="active:scale-95" render={<a href={href} target="_blank" rel="noopener noreferrer" />}>
            <ExternalLink className="size-4" />
            {t("openContact")}
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="active:scale-95">
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          {t("message")}
        </Button>
        {canManage && (
          <Button type="button" size="sm" variant={row.status === "pending" ? "default" : "outline"} onClick={changeStatus} disabled={isPending} className="active:scale-95">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : row.status === "pending" ? <Check className="size-4" /> : <RotateCcw className="size-4" />}
            {t(row.status === "pending" ? "markDone" : "reopen")}
          </Button>
        )}
      </div>
      {open && (
        <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
          <pre className="font-sans text-sm break-words whitespace-pre-wrap">{row.message}</pre>
          <Button type="button" variant="outline" size="sm" onClick={copy} className="w-fit active:scale-95">
            {copied ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
            {copied ? tBuilder("copied") : tBuilder("copy")}
          </Button>
        </div>
      )}
    </li>
  );
}

export function TeamRequestsTable({ rows, canManage }: { rows: TeamRequestRow[]; canManage: boolean }) {
  const t = useTranslations("admin.teamRequests.table");

  if (rows.length === 0) return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{t("empty")}</p>;
  return (
    <ul className="divide-y rounded-lg border">
      {rows.map((row) => (
        <RequestRow key={row.id} row={row} canManage={canManage} />
      ))}
    </ul>
  );
}

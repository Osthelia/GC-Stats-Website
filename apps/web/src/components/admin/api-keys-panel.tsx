/**
 * GC-Stats - api-keys-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BarChart3 } from "lucide-react";
import { useRouter, Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminSortableTh } from "@/components/admin/admin-sortable-th";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { ActiveStatusBadge } from "@/components/admin/active-status-badge";
import { ApiKeyDialog } from "@/components/admin/api-key-dialog";
import { RevealApiKeyDialog } from "@/components/admin/reveal-api-key-dialog";
import { regenerateApiKey, toggleApiKeyActive, deleteApiKey } from "@/actions/admin-api-keys";
import type { AdminApiKeyRow, SortDirection } from "@/lib/admin-api-keys";

export function ApiKeysPanel({
  keys,
  canManage,
  showUser,
  /** Fixed target user for creation, only relevant when `showUser` is false (scoped to one user's page). */
  userId,
  /** Server-sorted column headers (global /admin/api-keys list) — omitted on the user-scoped panel, which has too few rows to need sorting. */
  sortable,
  /** Omitted on the user-scoped panel, same reasoning as `sortable`. */
  pagination,
}: {
  keys: AdminApiKeyRow[];
  canManage: boolean;
  showUser: boolean;
  userId?: string;
  sortable?: { pathname: string; sort: string; direction: SortDirection; query: Record<string, string> };
  pagination?: { page: number; totalPages: number; total: number };
}) {
  const t = useTranslations("admin.apiKeys");
  const router = useRouter();
  const [editing, setEditing] = useState<AdminApiKeyRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [revealKey, setRevealKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRegenerate(key: AdminApiKeyRow) {
    if (!window.confirm(t("regenerateConfirm", { name: key.clientName }))) return;
    startTransition(async () => {
      const result = await regenerateApiKey(key.id);
      if (!result.ok) {
        toast.error(t("error.notFound"));
        return;
      }
      setRevealKey(result.plainKey);
    });
  }

  function handleToggle(key: AdminApiKeyRow) {
    startTransition(async () => {
      const result = await toggleApiKeyActive(key.id, !key.isActive);
      if (!result.ok) {
        toast.error(t("error.notFound"));
        return;
      }
      router.refresh();
      toast.success(key.isActive ? t("deactivateSuccess") : t("activateSuccess"));
    });
  }

  function handleDelete(key: AdminApiKeyRow) {
    if (!window.confirm(t("deleteConfirm", { name: key.clientName }))) return;
    startTransition(async () => {
      const result = await deleteApiKey(key.id);
      if (!result.ok) {
        toast.error(t("error.notFound"));
        return;
      }
      router.refresh();
      toast.success(t("deleteSuccess"));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("heading")}</h2>
        {canManage && <Button onClick={() => setCreating(true)}>{t("createButton")}</Button>}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {showUser &&
                (sortable ? (
                  <AdminSortableTh pathname={sortable.pathname} col="user" label={t("columnUser")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
                ) : (
                  <TableHead>{t("columnUser")}</TableHead>
                ))}
              {sortable ? (
                <AdminSortableTh pathname={sortable.pathname} col="clientName" label={t("columnClientName")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
              ) : (
                <TableHead>{t("columnClientName")}</TableHead>
              )}
              <TableHead>{t("columnKey")}</TableHead>
              <TableHead>{t("columnRateLimit")}</TableHead>
              <TableHead>{t("columnRequests")}</TableHead>
              {sortable ? (
                <AdminSortableTh pathname={sortable.pathname} col="status" label={t("columnStatus")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
              ) : (
                <TableHead>{t("columnStatus")}</TableHead>
              )}
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.length === 0 && (
              <TableRow>
                <TableCell colSpan={showUser ? 7 : 6} className="py-8 text-center text-sm text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {keys.map((key) => (
              <TableRow key={key.id}>
                {showUser && (
                  <TableCell>
                    {key.userId ? (
                      <Link href={`/admin/users/${key.userId}`} className="font-medium hover:underline">
                        {key.username ?? key.email ?? key.userId}
                      </Link>
                    ) : (
                      <Link href={`/admin/organizations/${key.organizationId}`} className="font-medium hover:underline">
                        {key.organizationName}
                      </Link>
                    )}
                  </TableCell>
                )}
                <TableCell className="font-medium">{key.clientName}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{key.keyHashPreview}…</TableCell>
                <TableCell className="text-muted-foreground">{key.rateLimit ?? t("noRateLimit")}</TableCell>
                <TableCell className="text-muted-foreground">{key.requestCount}</TableCell>
                <TableCell>
                  <ActiveStatusBadge active={key.isActive} activeLabel={t("statusActive")} inactiveLabel={t("statusInactive")} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" render={<Link href={`/admin/api-keys/${key.id}`} />}>
                      <BarChart3 className="size-4" />
                      {t("statsButton")}
                    </Button>
                    {canManage && (
                      <>
                        <Button variant="outline" size="sm" disabled={isPending} onClick={() => setEditing(key)}>
                          {t("editButton")}
                        </Button>
                        <Button variant="outline" size="sm" disabled={isPending} onClick={() => handleRegenerate(key)}>
                          {t("regenerateButton")}
                        </Button>
                        <Button variant="outline" size="sm" disabled={isPending} onClick={() => handleToggle(key)}>
                          {key.isActive ? t("deactivateButton") : t("activateButton")}
                        </Button>
                        <Button variant="outline" size="sm" disabled={isPending} onClick={() => handleDelete(key)} className="text-destructive hover:text-destructive">
                          {t("deleteButton")}
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pagination && sortable && (
        <AdminPagination pathname={sortable.pathname} page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} query={sortable.query} label={`${pagination.total}`} />
      )}

      <ApiKeyDialog apiKey={editing} open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} />
      <ApiKeyDialog
        apiKey={null}
        userId={userId}
        open={creating}
        onOpenChange={setCreating}
        onCreated={(plainKey) => {
          setRevealKey(plainKey);
          toast.success(t("createSuccess"));
        }}
      />
      <RevealApiKeyDialog plainKey={revealKey} onClose={() => setRevealKey(null)} />
    </div>
  );
}

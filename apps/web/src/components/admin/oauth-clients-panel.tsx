/**
 * GC-Stats - oauth-clients-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plug } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActiveStatusBadge } from "@/components/admin/active-status-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { OAuthClientDialog } from "@/components/admin/oauth-client-dialog";
import { RevealClientSecretDialog } from "@/components/admin/reveal-client-secret-dialog";
import { regenerateOAuthClientSecret, toggleOAuthClientActive, deleteOAuthClient } from "@/actions/admin-oauth-clients";
import type { AdminOAuthClientRow } from "@/lib/admin-oauth-clients";

function ClientLogo({ logoUrl, name }: { logoUrl: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  if (!logoUrl || broken) {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-muted text-muted-foreground">
        <Plug className="size-4" />
      </span>
    );
  }
  return <img src={logoUrl} alt={name} className="h-7 w-7 rounded-[6px] object-cover" onError={() => setBroken(true)} />;
}

export function OAuthClientsPanel({ clients, canManage }: { clients: AdminOAuthClientRow[]; canManage: boolean }) {
  const t = useTranslations("admin.oauthClients");
  const router = useRouter();
  const [editing, setEditing] = useState<AdminOAuthClientRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [reveal, setReveal] = useState<{ clientId: string; clientSecret: string | null } | null>(null);
  const [regenerating, setRegenerating] = useState<AdminOAuthClientRow | null>(null);
  const [deleting, setDeleting] = useState<AdminOAuthClientRow | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRegenerate() {
    if (!regenerating) return;
    startTransition(async () => {
      const result = await regenerateOAuthClientSecret(regenerating.id);
      setRegenerating(null);
      if (!result.ok) {
        toast.error(t(`error.${result.error}`));
        return;
      }
      setReveal({ clientId: regenerating.clientId, clientSecret: result.clientSecret });
    });
  }

  function handleToggle(client: AdminOAuthClientRow) {
    startTransition(async () => {
      const result = await toggleOAuthClientActive(client.id, !client.isActive);
      if (!result.ok) {
        toast.error(t("error.notFound"));
        return;
      }
      router.refresh();
      toast.success(client.isActive ? t("deactivateSuccess") : t("activateSuccess"));
    });
  }

  function handleDelete() {
    if (!deleting) return;
    startTransition(async () => {
      const result = await deleteOAuthClient(deleting.id);
      setDeleting(null);
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
              <TableHead>{t("columnName")}</TableHead>
              <TableHead>{t("columnClientId")}</TableHead>
              <TableHead>{t("columnType")}</TableHead>
              <TableHead>{t("columnScopes")}</TableHead>
              <TableHead>{t("columnStatus")}</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <ClientLogo logoUrl={client.logoUrl} name={client.name} />
                    {client.name}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{client.clientId}</TableCell>
                <TableCell className="text-muted-foreground">{client.isConfidential ? t("clientTypeConfidential") : t("clientTypePublic")}</TableCell>
                <TableCell className="text-muted-foreground">{client.allowedScopes.map((s) => t(`scope.${s}`)).join(", ")}</TableCell>
                <TableCell>
                  <ActiveStatusBadge active={client.isActive} activeLabel={t("statusActive")} inactiveLabel={t("statusInactive")} />
                </TableCell>
                <TableCell className="text-right">
                  {canManage && (
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" disabled={isPending} onClick={() => setEditing(client)}>
                        {t("editButton")}
                      </Button>
                      {client.isConfidential && (
                        <Button variant="outline" size="sm" disabled={isPending} onClick={() => setRegenerating(client)}>
                          {t("regenerateButton")}
                        </Button>
                      )}
                      <Button variant="outline" size="sm" disabled={isPending} onClick={() => handleToggle(client)}>
                        {client.isActive ? t("deactivateButton") : t("activateButton")}
                      </Button>
                      <Button variant="outline" size="sm" disabled={isPending} onClick={() => setDeleting(client)} className="text-destructive hover:text-destructive">
                        {t("deleteButton")}
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <OAuthClientDialog client={editing} open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} />
      <OAuthClientDialog
        client={null}
        open={creating}
        onOpenChange={setCreating}
        onCreated={(clientId, clientSecret) => {
          setReveal({ clientId, clientSecret });
          toast.success(t("createSuccess"));
        }}
      />
      <RevealClientSecretDialog reveal={reveal} onClose={() => setReveal(null)} />

      <ConfirmDialog
        open={regenerating !== null}
        onOpenChange={(open) => !open && setRegenerating(null)}
        title={t("regenerateConfirmTitle")}
        description={regenerating ? t("regenerateConfirm", { name: regenerating.name }) : ""}
        confirmLabel={t("regenerateButton")}
        cancelLabel={t("cancel")}
        onConfirm={handleRegenerate}
        isPending={isPending}
        destructive={false}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("deleteConfirmTitle")}
        description={deleting ? t("deleteConfirm", { name: deleting.name }) : ""}
        confirmLabel={t("deleteButton")}
        cancelLabel={t("cancel")}
        onConfirm={handleDelete}
        isPending={isPending}
      />
    </div>
  );
}

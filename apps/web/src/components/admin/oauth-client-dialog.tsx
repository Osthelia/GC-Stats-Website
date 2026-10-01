/**
 * GC-Stats - oauth-client-dialog
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-field";
import { createOAuthClient, updateOAuthClient, type OAuthClientFieldErrors } from "@/actions/admin-oauth-clients";
import { OAUTH_SCOPES, type OAuthScope } from "@/lib/oauth/scope-list";
import type { AdminOAuthClientRow } from "@/lib/admin-oauth-clients";

type FormState = { name: string; redirectUris: string; allowedScopes: OAuthScope[]; isConfidential: boolean; logoUrl: string };

function emptyState(): FormState {
  return { name: "", redirectUris: "", allowedScopes: [], isConfidential: true, logoUrl: "" };
}

function stateFromClient(client: AdminOAuthClientRow): FormState {
  return { name: client.name, redirectUris: client.redirectUris.join("\n"), allowedScopes: client.allowedScopes, isConfidential: client.isConfidential, logoUrl: client.logoUrl ?? "" };
}

export function OAuthClientDialog({
  client,
  open,
  onOpenChange,
  onCreated,
}: {
  client: AdminOAuthClientRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (clientId: string, clientSecret: string | null) => void;
}) {
  const t = useTranslations("admin.oauthClients");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<OAuthClientFieldErrors>({});
  const [form, setForm] = useState<FormState>(emptyState());

  useEffect(() => {
    if (open) {
      setForm(client ? stateFromClient(client) : emptyState());
      setFieldErrors({});
    }
  }, [open, client]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  function toggleScope(scope: OAuthScope) {
    setForm((prev) => ({ ...prev, allowedScopes: prev.allowedScopes.includes(scope) ? prev.allowedScopes.filter((s) => s !== scope) : [...prev.allowedScopes, scope] }));
  }

  function handleSubmit() {
    setFieldErrors({});

    if (client) {
      startTransition(async () => {
        const result = await updateOAuthClient(client.id, form);
        if (!result.ok) {
          setFieldErrors(result.fieldErrors);
          return;
        }
        onOpenChange(false);
        router.refresh();
        toast.success(t("updateSuccess"));
      });
      return;
    }

    startTransition(async () => {
      const result = await createOAuthClient(form);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      onOpenChange(false);
      router.refresh();
      onCreated?.(result.clientId, result.clientSecret);
    });
  }

  const err = (field: keyof OAuthClientFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}`) : undefined);

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{client ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{client ? t("editDescription") : t("createDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto py-2">
          <FormField label={t("fieldName")} htmlFor="oc-name" required error={err("name")}>
            <Input id="oc-name" value={form.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!fieldErrors.name} />
          </FormField>

          <FormField label={t("fieldRedirectUris")} htmlFor="oc-redirect-uris" required error={err("redirectUris")} hint={t("fieldRedirectUrisHint")}>
            <Textarea
              id="oc-redirect-uris"
              rows={3}
              value={form.redirectUris}
              onChange={(e) => set("redirectUris", e.target.value)}
              aria-invalid={!!fieldErrors.redirectUris}
              placeholder="https://example.com/oauth/callback"
            />
          </FormField>

          <FormField label={t("fieldScopes")} htmlFor="oc-scopes" required error={err("allowedScopes")}>
            <div className="flex flex-col gap-2">
              {OAUTH_SCOPES.map((scope) => (
                <label key={scope} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.allowedScopes.includes(scope)} onCheckedChange={() => toggleScope(scope)} />
                  {t(`scope.${scope}`)}
                </label>
              ))}
            </div>
          </FormField>

          <FormField label={t("fieldClientType")} htmlFor="oc-confidential" hint={client ? t("clientTypeLocked") : undefined}>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={form.isConfidential ? "default" : "outline"} onClick={() => set("isConfidential", true)} disabled={!!client}>
                {t("clientTypeConfidential")}
              </Button>
              <Button type="button" size="sm" variant={!form.isConfidential ? "default" : "outline"} onClick={() => set("isConfidential", false)} disabled={!!client}>
                {t("clientTypePublic")}
              </Button>
            </div>
          </FormField>

          <FormField label={t("fieldLogoUrl")} htmlFor="oc-logo-url" error={err("logoUrl")}>
            <Input id="oc-logo-url" value={form.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} aria-invalid={!!fieldErrors.logoUrl} />
          </FormField>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

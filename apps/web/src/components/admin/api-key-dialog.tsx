/**
 * GC-Stats - api-key-dialog
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-field";
import { UserPicker } from "@/components/admin/user-picker";
import { OrganizationPicker } from "@/components/admin/organization-picker";
import { createApiKey, updateApiKeyMeta, type ApiKeyFieldErrors, type ApiKeyOwner } from "@/actions/admin-api-keys";
import type { AdminApiKeyRow } from "@/lib/admin-api-keys";

type FormState = { clientName: string; rateLimit: string };
type OwnerType = "user" | "organization";

function emptyState(): FormState {
  return { clientName: "", rateLimit: "" };
}

function stateFromKey(key: AdminApiKeyRow): FormState {
  return { clientName: key.clientName, rateLimit: key.rateLimit === null ? "" : String(key.rateLimit) };
}

export function ApiKeyDialog({
  apiKey,
  userId,
  open,
  onOpenChange,
  onCreated,
}: {
  apiKey: AdminApiKeyRow | null;
  /** Fixed target user for creation — set when opened from a user's own admin page, which skips the owner picker below. Unused when editing. */
  userId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (plainKey: string) => void;
}) {
  const t = useTranslations("admin.apiKeys");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<ApiKeyFieldErrors>({});
  const [form, setForm] = useState<FormState>(emptyState());
  const [ownerType, setOwnerType] = useState<OwnerType>("user");
  const [ownerUser, setOwnerUser] = useState<{ id: string; username: string | null } | null>(null);
  const [ownerOrg, setOwnerOrg] = useState<{ id: number; name: string } | null>(null);
  const [ownerError, setOwnerError] = useState(false);

  // Opened with a fixed userId (a user's own admin page) → no owner picker at all.
  const ownerFixed = !apiKey && !!userId;

  useEffect(() => {
    if (open) {
      setForm(apiKey ? stateFromKey(apiKey) : emptyState());
      setFieldErrors({});
      setOwnerType("user");
      setOwnerUser(null);
      setOwnerOrg(null);
      setOwnerError(false);
    }
  }, [open, apiKey]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  function handleSubmit() {
    setFieldErrors({});
    setOwnerError(false);

    if (apiKey) {
      startTransition(async () => {
        const result = await updateApiKeyMeta(apiKey.id, form);
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

    let owner: ApiKeyOwner;
    if (ownerFixed && userId) {
      owner = { type: "user", userId };
    } else if (ownerType === "user") {
      if (!ownerUser) {
        setOwnerError(true);
        return;
      }
      owner = { type: "user", userId: ownerUser.id };
    } else {
      if (!ownerOrg) {
        setOwnerError(true);
        return;
      }
      owner = { type: "organization", organizationId: ownerOrg.id };
    }

    startTransition(async () => {
      const result = await createApiKey(owner, form);
      if (!result.ok) {
        if (result.error === "userNotFound" || result.error === "organizationNotFound") {
          toast.error(t(`error.${result.error}`));
          return;
        }
        setFieldErrors(result.fieldErrors);
        return;
      }
      onOpenChange(false);
      router.refresh();
      onCreated?.(result.plainKey);
    });
  }

  const err = (field: keyof ApiKeyFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}`) : undefined);

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{apiKey ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{apiKey ? t("editDescription") : t("createDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {!apiKey && !ownerFixed && (
            <FormField label={t("fieldOwner")} htmlFor="ak-owner-type" required error={ownerError ? t("error.ownerRequired") : undefined}>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={ownerType === "user" ? "default" : "outline"} onClick={() => setOwnerType("user")}>
                    {t("ownerUser")}
                  </Button>
                  <Button type="button" size="sm" variant={ownerType === "organization" ? "default" : "outline"} onClick={() => setOwnerType("organization")}>
                    {t("ownerOrganization")}
                  </Button>
                </div>
                {ownerType === "user" ? (
                  <UserPicker
                    value={ownerUser}
                    onChange={setOwnerUser}
                    placeholder={t("ownerUserPlaceholder")}
                    searchPlaceholder={t("ownerUserSearchPlaceholder")}
                    noResultsLabel={t("ownerNoResults")}
                  />
                ) : (
                  <OrganizationPicker
                    value={ownerOrg}
                    onChange={setOwnerOrg}
                    placeholder={t("ownerOrganizationPlaceholder")}
                    searchPlaceholder={t("ownerOrganizationSearchPlaceholder")}
                    noResultsLabel={t("ownerNoResults")}
                  />
                )}
              </div>
            </FormField>
          )}
          <FormField label={t("fieldClientName")} htmlFor="ak-client-name" required error={err("clientName")}>
            <Input id="ak-client-name" value={form.clientName} onChange={(e) => set("clientName", e.target.value)} aria-invalid={!!fieldErrors.clientName} />
          </FormField>
          <FormField label={t("fieldRateLimit")} htmlFor="ak-rate-limit" error={err("rateLimit")} hint={t("fieldRateLimitHint")}>
            <Input id="ak-rate-limit" type="number" min="1" value={form.rateLimit} onChange={(e) => set("rateLimit", e.target.value)} aria-invalid={!!fieldErrors.rateLimit} />
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

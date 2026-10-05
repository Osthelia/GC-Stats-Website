/**
 * GC-Stats - about-team-member-dialog
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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-field";
import { saveAboutTeamMemberSettings, type MemberFieldErrors } from "@/actions/admin-about-team";
import type { AboutTeamMemberRow, AboutTeamCategoryRow } from "@/lib/admin-about-team";

const NO_CATEGORY = "__none__";

type FormState = { categoryId: string; displayRoleFr: string; displayRoleEn: string; isVisible: boolean; order: string };

function stateFromMember(member: AboutTeamMemberRow): FormState {
  return {
    categoryId: member.categoryId !== null ? String(member.categoryId) : NO_CATEGORY,
    displayRoleFr: member.displayRole?.fr ?? "",
    displayRoleEn: member.displayRole?.en ?? "",
    isVisible: member.isVisible,
    order: String(member.order),
  };
}

export function AboutTeamMemberDialog({
  member,
  categories,
  open,
  onOpenChange,
}: {
  member: AboutTeamMemberRow | null;
  categories: AboutTeamCategoryRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("admin.about.team.members");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<MemberFieldErrors>({});
  const [form, setForm] = useState<FormState>({ categoryId: NO_CATEGORY, displayRoleFr: "", displayRoleEn: "", isVisible: true, order: "0" });

  useEffect(() => {
    if (open && member) {
      setForm(stateFromMember(member));
      setFieldErrors({});
    }
  }, [open, member]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  function handleSubmit() {
    if (!member) return;
    setFieldErrors({});
    startTransition(async () => {
      const result = await saveAboutTeamMemberSettings({
        userId: member.userId,
        categoryId: form.categoryId === NO_CATEGORY ? null : Number(form.categoryId),
        displayRoleFr: form.displayRoleFr,
        displayRoleEn: form.displayRoleEn,
        isVisible: form.isVisible,
        order: form.order,
      });
      if (!result.ok) {
        if ("error" in result) {
          toast.error(t("error.notFound"));
          return;
        }
        setFieldErrors(result.fieldErrors);
        return;
      }
      onOpenChange(false);
      router.refresh();
      toast.success(t("saveSuccess"));
    });
  }

  const err = (field: keyof MemberFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}`) : undefined);
  const categoryItems = Object.fromEntries([[NO_CATEGORY, t("noCategory")], ...categories.map((c) => [String(c.id), c.label.fr || c.key])]);

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{member ? (member.name || member.username) : ""}</DialogTitle>
          <DialogDescription>{t("editDescription")}</DialogDescription>
        </DialogHeader>

        {member && (
          <div className="flex flex-col gap-4 py-2">
            <FormField label={t("fieldCategory")} htmlFor="atm-category">
              <Select items={categoryItems} value={form.categoryId} onValueChange={(v) => set("categoryId", v ?? NO_CATEGORY)}>
                <SelectTrigger id="atm-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CATEGORY}>{t("noCategory")}</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.label.fr || c.key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label={t("fieldDisplayRoleFr")} htmlFor="atm-role-fr" error={err("displayRoleFr")} hint={t("fieldDisplayRoleHint")}>
                <Input id="atm-role-fr" value={form.displayRoleFr} onChange={(e) => set("displayRoleFr", e.target.value)} aria-invalid={!!fieldErrors.displayRoleFr} />
              </FormField>
              <FormField label={t("fieldDisplayRoleEn")} htmlFor="atm-role-en" error={err("displayRoleEn")}>
                <Input id="atm-role-en" value={form.displayRoleEn} onChange={(e) => set("displayRoleEn", e.target.value)} aria-invalid={!!fieldErrors.displayRoleEn} />
              </FormField>
            </div>

            <div className="grid grid-cols-2 items-end gap-4">
              <FormField label={t("fieldOrder")} htmlFor="atm-order" error={err("order")}>
                <Input id="atm-order" type="number" min="0" value={form.order} onChange={(e) => set("order", e.target.value)} aria-invalid={!!fieldErrors.order} />
              </FormField>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <Checkbox checked={form.isVisible} onCheckedChange={(checked) => set("isVisible", checked === true)} />
                {t("fieldIsVisible")}
              </label>
            </div>
          </div>
        )}

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

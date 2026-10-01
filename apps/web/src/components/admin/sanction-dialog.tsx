/**
 * GC-Stats - sanction-dialog
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-field";
import { UserPicker } from "@/components/admin/user-picker";
import { TeamPicker } from "@/components/admin/team-picker";
import { cn } from "@/lib/utils";
import { createSanction, type SanctionFieldErrors } from "@/actions/admin-sanctions";
import { SANCTION_TYPES } from "@/lib/sanction-constants";

type TargetMode = "user" | "team";

function nowLocalInput(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function SanctionDialog({
  open,
  onOpenChange,
  initialUser = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selects the target user (e.g. opened from a report review) instead of starting empty. */
  initialUser?: { id: string; username: string | null } | null;
}) {
  const t = useTranslations("admin.sanctions");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<SanctionFieldErrors>({});
  const [targetMode, setTargetMode] = useState<TargetMode>("user");
  const [user, setUser] = useState<{ id: string; username: string | null } | null>(null);
  const [team, setTeam] = useState<{ id: number; name: string } | null>(null);
  const [type, setType] = useState<string>("warning");
  const [reason, setReason] = useState("");
  const [startsAt, setStartsAt] = useState(nowLocalInput());
  const [endsAt, setEndsAt] = useState("");

  useEffect(() => {
    if (open) {
      setFieldErrors({});
      setTargetMode("user");
      setUser(initialUser);
      setTeam(null);
      setType("warning");
      setReason("");
      setStartsAt(nowLocalInput());
      setEndsAt("");
    }
  }, [open, initialUser]);

  function handleSubmit() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await createSanction({
        userId: targetMode === "user" ? (user?.id ?? null) : null,
        teamId: targetMode === "team" ? (team?.id ?? null) : null,
        type,
        reason,
        startsAt: startsAt ? new Date(startsAt).toISOString() : "",
        endsAt: endsAt ? new Date(endsAt).toISOString() : "",
      });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      onOpenChange(false);
      router.refresh();
      toast.success(t("createSuccess"));
    });
  }

  const err = (field: keyof SanctionFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}`) : undefined);
  const typeItems = Object.fromEntries(SANCTION_TYPES.map((v) => [v, t(`type.${v}`)]));

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("createTitle")}</DialogTitle>
          <DialogDescription>{t("createDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <FormField label={t("fieldTarget")} htmlFor="sanction-target" required error={err("target")}>
            <div className="flex flex-col gap-2">
              <div className="inline-flex w-fit rounded-lg border border-input p-0.5">
                <button
                  type="button"
                  onClick={() => setTargetMode("user")}
                  className={cn("rounded-md px-3 py-1 text-xs font-medium transition-colors", targetMode === "user" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  {t("targetUser")}
                </button>
                <button
                  type="button"
                  onClick={() => setTargetMode("team")}
                  className={cn("rounded-md px-3 py-1 text-xs font-medium transition-colors", targetMode === "team" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  {t("targetTeam")}
                </button>
              </div>
              {targetMode === "user" ? (
                <UserPicker value={user} onChange={setUser} placeholder={t("pickUserPlaceholder")} searchPlaceholder={t("pickUserSearchPlaceholder")} noResultsLabel={t("pickNoResults")} />
              ) : (
                <TeamPicker value={team} onChange={setTeam} placeholder={t("pickTeamPlaceholder")} searchPlaceholder={t("pickTeamSearchPlaceholder")} noResultsLabel={t("pickNoResults")} />
              )}
            </div>
          </FormField>

          <FormField label={t("fieldType")} htmlFor="sanction-type" required>
            <Select items={typeItems} value={type} onValueChange={(v) => v && setType(v)}>
              <SelectTrigger id="sanction-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SANCTION_TYPES.map((v) => (
                  <SelectItem key={v} value={v}>
                    {t(`type.${v}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label={t("fieldReason")} htmlFor="sanction-reason" required error={err("reason")}>
            <Textarea id="sanction-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} aria-invalid={!!fieldErrors.reason} />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("fieldStartsAt")} htmlFor="sanction-starts" required error={err("startsAt")}>
              <Input id="sanction-starts" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} aria-invalid={!!fieldErrors.startsAt} />
            </FormField>
            <FormField label={t("fieldEndsAt")} htmlFor="sanction-ends" error={err("endsAt")} hint={t("fieldEndsAtHint")}>
              <Input id="sanction-ends" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} aria-invalid={!!fieldErrors.endsAt} />
            </FormField>
          </div>
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

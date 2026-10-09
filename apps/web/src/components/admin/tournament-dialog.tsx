/**
 * GC-Stats - tournament-dialog
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-field";
import { TagsInput } from "@/components/admin/tags-input";
import { OrganizationPicker } from "@/components/admin/organization-picker";
import { createTournament, updateTournament, type TournamentFieldErrors, type TournamentInput } from "@/actions/admin-tournaments";
import type { AdminTournamentDetailRow } from "@/lib/admin-tournaments";

const STATUS_VALUES = ["upcoming", "live", "finished"] as const;
const SOCIAL_KEYS = ["twitter", "twitch", "instagram", "youtube", "tiktok", "discord", "website"] as const;
const NONE = "none";

type FormState = TournamentInput;

function emptyState(): FormState {
  return {
    name: "",
    region: "",
    category: "",
    startDate: "",
    endDate: "",
    status: "upcoming",
    active: false,
    pointTypeId: null,
    organizerOrganizationId: null,
    location: "",
    prizePool: "",
    description: "",
    keywords: [],
    liquipediaLink: "",
    socials: {},
    playerPovPhrase: "",
  };
}

function stateFromTournament(tournament: AdminTournamentDetailRow): FormState {
  return {
    name: tournament.name,
    region: tournament.region ?? "",
    category: tournament.category ?? "",
    startDate: tournament.startDate.slice(0, 10),
    endDate: tournament.endDate.slice(0, 10),
    status: tournament.status,
    active: tournament.active,
    pointTypeId: tournament.pointTypeId,
    organizerOrganizationId: tournament.organizerOrganizationId,
    location: tournament.location ?? "",
    prizePool: tournament.prizePool ?? "",
    description: tournament.description ?? "",
    keywords: tournament.keywords,
    liquipediaLink: tournament.liquipediaLink ?? "",
    socials: tournament.socials,
    playerPovPhrase: tournament.playerPovPhrase ?? "",
  };
}

export function TournamentDialog({
  tournament,
  pointTypeOptions,
  open,
  onOpenChange,
  onSaved,
}: {
  tournament: AdminTournamentDetailRow | null;
  pointTypeOptions: { id: number; name: string; label: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (id: number) => void;
}) {
  const t = useTranslations("admin.tournaments");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<TournamentFieldErrors>({});
  const [form, setForm] = useState<FormState>(emptyState());
  const [organizer, setOrganizer] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    if (open) {
      setForm(tournament ? stateFromTournament(tournament) : emptyState());
      setOrganizer(tournament?.organizerOrganizationId != null ? { id: tournament.organizerOrganizationId, name: tournament.organizerOrganizationName ?? "" } : null);
      setFieldErrors({});
    }
  }, [open, tournament]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  function handleSubmit() {
    setFieldErrors({});
    startTransition(async () => {
      const result = tournament ? await updateTournament(tournament.id, form) : await createTournament(form);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      onOpenChange(false);
      router.refresh();
      toast.success(tournament ? t("updateSuccess") : t("createSuccess"));
      onSaved?.(result.id);
    });
  }

  const err = (field: keyof TournamentFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}`) : undefined);

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{tournament ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{tournament ? t("editDescription") : t("createDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto py-2">
          <FormField label={t("fieldName")} htmlFor="tn-name" required error={err("name")}>
            <Input id="tn-name" value={form.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!fieldErrors.name} />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("fieldRegion")} htmlFor="tn-region">
              <Input id="tn-region" value={form.region} onChange={(e) => set("region", e.target.value)} />
            </FormField>
            <FormField label={t("fieldCategory")} htmlFor="tn-category">
              <Input id="tn-category" value={form.category} onChange={(e) => set("category", e.target.value)} />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("fieldStartDate")} htmlFor="tn-start-date" required error={err("startDate")}>
              <Input id="tn-start-date" type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} aria-invalid={!!fieldErrors.startDate} />
            </FormField>
            <FormField label={t("fieldEndDate")} htmlFor="tn-end-date" required error={err("endDate")}>
              <Input id="tn-end-date" type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} aria-invalid={!!fieldErrors.endDate} />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("fieldStatus")} htmlFor="tn-status" required error={err("status")}>
              <Select items={Object.fromEntries(STATUS_VALUES.map((s) => [s, t(`status.${s}`)]))} value={form.status} onValueChange={(v) => v && set("status", v)}>
                <SelectTrigger id="tn-status" aria-invalid={!!fieldErrors.status} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_VALUES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`status.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label={t("fieldPointType")} htmlFor="tn-point-type" error={err("pointTypeId")}>
              <Select
                items={{ [NONE]: t("fieldPointTypeNone"), ...Object.fromEntries(pointTypeOptions.map((p) => [String(p.id), `${p.name} (${p.label})`])) }}
                value={form.pointTypeId === null ? NONE : String(form.pointTypeId)}
                onValueChange={(v) => set("pointTypeId", v === NONE ? null : Number(v))}
              >
                <SelectTrigger id="tn-point-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("fieldPointTypeNone")}</SelectItem>
                  {pointTypeOptions.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} ({p.label})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <FormField label={t("fieldOrganizer")} htmlFor="tn-organizer" error={err("organizerOrganizationId")}>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <OrganizationPicker
                  value={organizer}
                  onChange={(org) => {
                    setOrganizer(org);
                    set("organizerOrganizationId", org?.id ?? null);
                  }}
                  placeholder={t("organizerPlaceholder")}
                  searchPlaceholder={t("organizerSearchPlaceholder")}
                  noResultsLabel={t("organizerNoResults")}
                />
              </div>
              {organizer && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setOrganizer(null);
                    set("organizerOrganizationId", null);
                  }}
                >
                  {t("organizerClear")}
                </Button>
              )}
            </div>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("fieldLocation")} htmlFor="tn-location" error={err("location")}>
              <Input id="tn-location" value={form.location} onChange={(e) => set("location", e.target.value)} aria-invalid={!!fieldErrors.location} />
            </FormField>
            <FormField label={t("fieldPrizePool")} htmlFor="tn-prize-pool" error={err("prizePool")}>
              <Input id="tn-prize-pool" value={form.prizePool} onChange={(e) => set("prizePool", e.target.value)} aria-invalid={!!fieldErrors.prizePool} />
            </FormField>
          </div>

          <FormField label={t("fieldDescription")} htmlFor="tn-description" error={err("description")}>
            <Textarea id="tn-description" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} aria-invalid={!!fieldErrors.description} />
          </FormField>

          <FormField label={t("fieldKeywords")} htmlFor="tn-keywords" error={err("keywords")}>
            <p className="text-xs text-muted-foreground">{t("keywordsHint")}</p>
            <TagsInput
              value={form.keywords}
              onChange={(keywords) => set("keywords", keywords)}
              placeholder={t("keywordsPlaceholder")}
              addLabel={t("keywordsAdd")}
              emptyLabel={t("keywordsEmpty")}
              removeLabel={t("keywordsRemove")}
              disabled={isPending}
            />
          </FormField>

          <FormField label={t("fieldLiquipedia")} htmlFor="tn-liquipedia" error={err("liquipediaLink")}>
            <Input
              id="tn-liquipedia"
              type="url"
              value={form.liquipediaLink}
              placeholder="https://liquipedia.net/…"
              onChange={(e) => set("liquipediaLink", e.target.value)}
              aria-invalid={!!fieldErrors.liquipediaLink}
            />
          </FormField>

          <FormField label={t("fieldPlayerPovPhrase")} htmlFor="tn-pov-phrase" error={err("playerPovPhrase")}>
            <Input id="tn-pov-phrase" value={form.playerPovPhrase} onChange={(e) => set("playerPovPhrase", e.target.value)} aria-invalid={!!fieldErrors.playerPovPhrase} />
          </FormField>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.active} onCheckedChange={(checked) => set("active", checked === true)} />
            {t("fieldActive")}
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t("sectionSocials")}</span>
            <div className="grid grid-cols-2 gap-4">
              {SOCIAL_KEYS.map((key) => (
                <FormField
                  key={key}
                  label={t(`socialLabels.${key}`)}
                  htmlFor={`tn-social-${key}`}
                  error={fieldErrors.socials?.[key] ? t(`error.${fieldErrors.socials[key]}`) : undefined}
                >
                  <Input
                    id={`tn-social-${key}`}
                    value={form.socials[key] ?? ""}
                    onChange={(e) => set("socials", { ...form.socials, [key]: e.target.value })}
                    aria-invalid={!!fieldErrors.socials?.[key]}
                  />
                </FormField>
              ))}
            </div>
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

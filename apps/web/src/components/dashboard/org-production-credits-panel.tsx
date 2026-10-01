/**
 * GC-Stats - org-production-credits-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PersonPicker } from "@/components/admin/person-picker";
import { CountryFlag } from "@/components/admin/country-flag";
import { RequiredMark } from "@/components/admin/required-mark";
import { EntitySinglePicker } from "@/components/dashboard/news/entity-single-picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { EntityOption } from "@/components/dashboard/news/entity-multi-picker";
import {
  addProductionCredit,
  updateProductionCredit,
  deleteProductionCredit,
  searchTournamentsForCredit,
  getMatchOptionsForCredit,
  type ProductionCreditFieldErrors,
  type ProductionCreditScope,
  type CreditMatchOption,
} from "@/actions/dashboard-production-credits";
import { searchPeopleForOrganization } from "@/actions/dashboard-organizations";
import { PRODUCTION_CREDIT_ROLES, PRODUCTION_CREDIT_ROLE_OTHER } from "@/lib/production-credit-roles";
import type { OrgProductionCredit } from "@/lib/production-credits-data";

const NONE_MATCH = "__none__";

/** credit.role is free text (see production-credit-roles.ts), splits it back into a known <Select> value plus the "other" free-text field the row should start with. */
function decodeRole(role: string): { role: string; roleOther: string } {
  if ((PRODUCTION_CREDIT_ROLES as readonly string[]).includes(role)) return { role, roleOther: "" };
  return { role: PRODUCTION_CREDIT_ROLE_OTHER, roleOther: role };
}

function roleItemsFor(t: ReturnType<typeof useTranslations>): Record<string, string> {
  const items: Record<string, string> = Object.fromEntries(PRODUCTION_CREDIT_ROLES.map((r) => [r, t(`role.${r}` as "role.caster")]));
  items[PRODUCTION_CREDIT_ROLE_OTHER] = t("role.other");
  return items;
}

function targetLabel(t: ReturnType<typeof useTranslations>, credit: OrgProductionCredit): string {
  if (credit.target.scope === "tournament") return t("targetTournament", { name: credit.target.tournamentName });
  return t("targetMatch", { label: credit.target.label, tournament: credit.target.tournamentName ?? "?" });
}

function CreditRow({
  organizationId,
  canManage,
  credit,
  onSaved,
  onDeleted,
}: {
  organizationId: number;
  canManage: boolean;
  credit: OrgProductionCredit;
  onSaved: (updated: OrgProductionCredit) => void;
  onDeleted: (creditId: number) => void;
}) {
  const t = useTranslations("dashboard.credits");
  const [isPending, startTransition] = useTransition();
  const decoded = decodeRole(credit.role);
  const [role, setRole] = useState(decoded.role);
  const [roleOther, setRoleOther] = useState(decoded.roleOther);
  const [titleOverride, setTitleOverride] = useState(credit.titleOverride ?? "");
  const [fieldErrors, setFieldErrors] = useState<ProductionCreditFieldErrors>({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const roleItems = roleItemsFor(t);
  const err = (field: keyof ProductionCreditFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}` as "error.required") : undefined);

  function handleSave() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await updateProductionCredit(organizationId, credit.id, { role, roleOther, titleOverride });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      onSaved({ ...credit, role: role === PRODUCTION_CREDIT_ROLE_OTHER ? roleOther.trim() : role, titleOverride: titleOverride.trim() || null });
      toast.success(t("saveSuccess"));
    });
  }

  function confirmDelete() {
    setDeleteConfirmOpen(false);
    startTransition(async () => {
      const result = await deleteProductionCredit(organizationId, credit.id);
      if (!result.ok) {
        toast.error(t("deleteError"));
        return;
      }
      onDeleted(credit.id);
      toast.success(t("deleteSuccess"));
    });
  }

  const initial = credit.handle.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border">
      <div className="h-1 w-full shrink-0 bg-violet-400" />
      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-black text-primary">{initial}</div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-1.5 truncate font-medium">
              <CountryFlag code={credit.countryCode} secondaryCode={credit.secondaryCountryCode} className="size-3.5 shrink-0" />
              <span className="truncate">{credit.handle}</span>
            </div>
            <Badge variant="outline" className="w-fit max-w-full truncate">
              {targetLabel(t, credit)}
            </Badge>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-[11px] text-muted-foreground">
              {t("roleLabel")}
              <RequiredMark />
            </Label>
            <Select items={roleItems} value={role} onValueChange={(v) => v && setRole(v)} disabled={!canManage}>
              <SelectTrigger aria-label={t("roleLabel")} aria-invalid={!!fieldErrors.role} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCTION_CREDIT_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {roleItems[r]}
                  </SelectItem>
                ))}
                <SelectItem value={PRODUCTION_CREDIT_ROLE_OTHER}>{roleItems[PRODUCTION_CREDIT_ROLE_OTHER]}</SelectItem>
              </SelectContent>
            </Select>
            {err("role") && (
              <p role="alert" className="text-xs text-destructive">
                {err("role")}
              </p>
            )}
          </div>

          {role === PRODUCTION_CREDIT_ROLE_OTHER && (
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">
                {t("roleOtherLabel")}
                <RequiredMark />
              </Label>
              <Input value={roleOther} onChange={(e) => setRoleOther(e.target.value)} aria-invalid={!!fieldErrors.roleOther} disabled={!canManage} />
              {err("roleOther") && (
                <p role="alert" className="text-xs text-destructive">
                  {err("roleOther")}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <Label className="text-[11px] text-muted-foreground">{t("titleOverrideLabel")}</Label>
            <Input value={titleOverride} onChange={(e) => setTitleOverride(e.target.value)} placeholder={t("titleOverridePlaceholder")} aria-invalid={!!fieldErrors.titleOverride} disabled={!canManage} />
            {err("titleOverride") && (
              <p role="alert" className="text-xs text-destructive">
                {err("titleOverride")}
              </p>
            )}
          </div>
        </div>

        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={isPending} onClick={handleSave} className="flex-1">
              {isPending ? (
                <>
                  <Loader2Icon className="size-3.5 animate-spin" />
                  {t("saving")}
                </>
              ) : (
                t("save")
              )}
            </Button>
            <Button variant="ghost" size="sm" disabled={isPending} onClick={() => setDeleteConfirmOpen(true)} className="text-destructive hover:text-destructive">
              {t("deleteButton")}
            </Button>
          </div>
        )}

        <ConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          title={t("deleteButton")}
          description={t("deleteConfirm", { name: credit.handle })}
          confirmLabel={t("deleteButton")}
          cancelLabel={t("cancel")}
          onConfirm={confirmDelete}
          isPending={isPending}
        />
      </div>
    </div>
  );
}

function AddCreditForm({ organizationId, onAdded }: { organizationId: number; onAdded: () => void }) {
  const t = useTranslations("dashboard.credits");
  const [isPending, startTransition] = useTransition();
  const [person, setPerson] = useState<{ id: number; handle: string } | null>(null);
  const [scope, setScope] = useState<ProductionCreditScope>("tournament");
  const [tournament, setTournament] = useState<EntityOption | null>(null);
  const [matchOptions, setMatchOptions] = useState<CreditMatchOption[]>([]);
  const [matchId, setMatchId] = useState<number | null>(null);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [role, setRole] = useState<string>(PRODUCTION_CREDIT_ROLES[0]);
  const [roleOther, setRoleOther] = useState("");
  const [titleOverride, setTitleOverride] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ProductionCreditFieldErrors>({});

  const roleItems = roleItemsFor(t);

  useEffect(() => {
    setMatchId(null);
    if (scope !== "match" || !tournament) {
      setMatchOptions([]);
      return;
    }
    let cancelled = false;
    setLoadingMatches(true);
    getMatchOptionsForCredit(organizationId, tournament.id).then((rows) => {
      if (cancelled) return;
      setMatchOptions(rows);
      setLoadingMatches(false);
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId, scope, tournament]);

  const scopeItems = { tournament: t("scopeTournament"), match: t("scopeMatch") };
  const matchItems = Object.fromEntries(matchOptions.map((m) => [String(m.id), m.label]));

  function handleAdd() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await addProductionCredit(organizationId, {
        personId: person?.id ?? null,
        role,
        roleOther,
        titleOverride,
        scope,
        tournamentId: tournament?.id ?? null,
        matchId,
      });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      setPerson(null);
      setTournament(null);
      setMatchId(null);
      setTitleOverride("");
      toast.success(t("addSuccess"));
      onAdded();
    });
  }

  const err = (field: keyof ProductionCreditFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}` as "error.required") : undefined);

  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <p className="text-sm font-medium">{t("addTitle")}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label>
            {t("personLabel")}
            <RequiredMark />
          </Label>
          <PersonPicker
            value={person}
            onChange={setPerson}
            placeholder={t("personPlaceholder")}
            searchPlaceholder={t("personSearchPlaceholder")}
            noResultsLabel={t("personNoResults")}
            search={(q) => searchPeopleForOrganization(organizationId, q)}
          />
          {err("person") && (
            <p role="alert" className="text-xs text-destructive">
              {err("person")}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>
            {t("scopeLabel")}
            <RequiredMark />
          </Label>
          <Select items={scopeItems} value={scope} onValueChange={(v) => v && setScope(v as ProductionCreditScope)}>
            <SelectTrigger aria-label={t("scopeLabel")} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tournament">{scopeItems.tournament}</SelectItem>
              <SelectItem value="match">{scopeItems.match}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>
            {t("tournamentLabel")}
            <RequiredMark />
          </Label>
          <EntitySinglePicker
            value={tournament}
            onChange={setTournament}
            search={(q) => searchTournamentsForCredit(organizationId, q).then((rows) => rows.map((r) => ({ id: r.id, label: r.name })))}
            placeholder={t("tournamentPlaceholder")}
            searchPlaceholder={t("tournamentSearchPlaceholder")}
            noResultsLabel={t("tournamentNoResults")}
            clearLabel={t("clear")}
          />
          {err("tournament") && (
            <p role="alert" className="text-xs text-destructive">
              {err("tournament")}
            </p>
          )}
        </div>

        {scope === "match" && (
          <div className="flex flex-col gap-1.5">
            <Label>
              {t("matchLabel")}
              <RequiredMark />
            </Label>
            <Select
              items={{ [NONE_MATCH]: loadingMatches ? t("matchLoading") : !tournament ? t("matchPickTournamentFirst") : t("matchPlaceholder"), ...matchItems }}
              value={matchId !== null ? String(matchId) : NONE_MATCH}
              onValueChange={(v) => setMatchId(v && v !== NONE_MATCH ? Number(v) : null)}
              disabled={!tournament || loadingMatches}
            >
              <SelectTrigger aria-label={t("matchLabel")} aria-invalid={!!fieldErrors.match} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_MATCH}>{loadingMatches ? t("matchLoading") : !tournament ? t("matchPickTournamentFirst") : t("matchPlaceholder")}</SelectItem>
                {matchOptions.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {err("match") && (
              <p role="alert" className="text-xs text-destructive">
                {err("match")}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label>
            {t("roleLabel")}
            <RequiredMark />
          </Label>
          <Select items={roleItems} value={role} onValueChange={(v) => v && setRole(v)}>
            <SelectTrigger aria-label={t("roleLabel")} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRODUCTION_CREDIT_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {roleItems[r]}
                </SelectItem>
              ))}
              <SelectItem value={PRODUCTION_CREDIT_ROLE_OTHER}>{roleItems[PRODUCTION_CREDIT_ROLE_OTHER]}</SelectItem>
            </SelectContent>
          </Select>
          {err("role") && (
            <p role="alert" className="text-xs text-destructive">
              {err("role")}
            </p>
          )}
        </div>

        {role === PRODUCTION_CREDIT_ROLE_OTHER && (
          <div className="flex flex-col gap-1.5">
            <Label>
              {t("roleOtherLabel")}
              <RequiredMark />
            </Label>
            <Input value={roleOther} onChange={(e) => setRoleOther(e.target.value)} aria-invalid={!!fieldErrors.roleOther} />
            {err("roleOther") && (
              <p role="alert" className="text-xs text-destructive">
                {err("roleOther")}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label>{t("titleOverrideLabel")}</Label>
          <Input value={titleOverride} onChange={(e) => setTitleOverride(e.target.value)} placeholder={t("titleOverridePlaceholder")} aria-invalid={!!fieldErrors.titleOverride} />
          {err("titleOverride") && (
            <p role="alert" className="text-xs text-destructive">
              {err("titleOverride")}
            </p>
          )}
        </div>

        <div className="flex items-end">
          <Button variant="outline" disabled={isPending} onClick={handleAdd} className="w-full">
            {isPending ? (
              <>
                <Loader2Icon className="size-3.5 animate-spin" />
                {t("addSubmitting")}
              </>
            ) : (
              t("addSubmit")
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function OrgProductionCreditsPanel({ organizationId, initialCredits, canManage }: { organizationId: number; initialCredits: OrgProductionCredit[]; canManage: boolean }) {
  const t = useTranslations("dashboard.credits");
  const router = useRouter();
  const [credits, setCredits] = useState(initialCredits);

  function handleSaved(updated: OrgProductionCredit) {
    setCredits((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  function handleDeleted(creditId: number) {
    setCredits((prev) => prev.filter((c) => c.id !== creditId));
  }

  return (
    <div className="flex flex-col gap-4">
      {!canManage && <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{t("readOnlyHint")}</p>}

      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t("hint")}</p>

          {credits.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}

          {credits.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {credits.map((c) => (
                <CreditRow key={c.id} organizationId={organizationId} canManage={canManage} credit={c} onSaved={handleSaved} onDeleted={handleDeleted} />
              ))}
            </div>
          )}

          {canManage && (
            <AddCreditForm
              organizationId={organizationId}
              onAdded={() => {
                // A new credit needs the same match/tournament label resolution the
                // server-side listing does (join across matches/entrants), so a router
                // refresh is simpler than duplicating that resolution client-side.
                router.refresh();
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

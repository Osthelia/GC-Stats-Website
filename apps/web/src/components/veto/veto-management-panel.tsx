/**
 * GC-Stats - veto-management-panel
 *
 * Manages the live veto of one tournament: settings, map pools, team links
 * and resets. Shared by the admin and the organizer dashboard, which only
 * differ by the scope passed to the actions.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Copy, Link2, MonitorPlay, RefreshCw, RotateCcw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RequiredMark } from "@/components/admin/required-mark";
import { saveVetoSettings, saveMatchVetoPool, regenerateTeamVetoLink, resetMatchVeto, type VetoSettingsFieldErrors } from "@/actions/veto-management";
import { VALORANT_MAP_POOL } from "@/lib/valorant-maps";
import { WIDGETS_URL } from "@/lib/widget-params";
import { cn } from "@/lib/utils";
import type { VetoManagementData, VetoManagedEntrant, VetoManagedMatch } from "@/lib/veto/management-data";

type Scope = { organizationId?: number };
type Translate = ReturnType<typeof useTranslations>;

const MODES = ["coin_toss", "coin_toss_winner", "advantage", "predefined"] as const;
const NONE = "none";

function errorText(t: Translate, field: string, code: string | undefined): string | null {
  return code ? t(`error.${field}.${code}`) : null;
}

export function VetoManagementPanel({ data, scope }: { data: VetoManagementData; scope: Scope }) {
  return (
    <div className="flex flex-col gap-6">
      <SettingsCard data={data} scope={scope} />
      <TeamLinksCard data={data} scope={scope} />
      <MatchesCard data={data} scope={scope} />
    </div>
  );
}

function MapToggleGrid({ value, onChange, disabled }: { value: string[]; onChange: (maps: string[]) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {VALORANT_MAP_POOL.map((mapName) => {
        const selected = value.includes(mapName);
        return (
          <button
            key={mapName}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onChange(selected ? value.filter((m) => m !== mapName) : [...value, mapName])}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95 disabled:pointer-events-none disabled:opacity-50",
              selected ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-muted"
            )}
          >
            {mapName}
          </button>
        );
      })}
    </div>
  );
}

function SettingsCard({ data, scope }: { data: VetoManagementData; scope: Scope }) {
  const t = useTranslations("admin.vetoManagement");
  const [isPending, startTransition] = useTransition();
  const { settings } = data;
  const [mode, setMode] = useState<string>(settings.firstMoverMode);
  const [advantage, setAdvantage] = useState<string>(settings.advantageEntrantId !== null ? String(settings.advantageEntrantId) : NONE);
  const [slot, setSlot] = useState<string>(settings.predefinedSlot);
  const [timeout, setTimeoutValue] = useState(String(settings.actionTimeoutSeconds));
  const [pool, setPool] = useState<string[]>(settings.mapPool);
  const [patch, setPatch] = useState(settings.mapPoolPatch ?? "");
  const [errors, setErrors] = useState<VetoSettingsFieldErrors>({});

  const modeItems = Object.fromEntries(MODES.map((m) => [m, t(`mode.${m}`)]));
  const slotItems = { a: t("slotA"), b: t("slotB") };
  const advantageItems: Record<string, string> = { [NONE]: t("advantageNone"), ...Object.fromEntries(data.entrants.map((e) => [String(e.id), e.displayName])) };

  function handleSave() {
    setErrors({});
    startTransition(async () => {
      const result = await saveVetoSettings(
        data.tournament.id,
        { firstMoverMode: mode, advantageEntrantId: advantage === NONE ? null : Number(advantage), predefinedSlot: slot, actionTimeoutSeconds: timeout, mapPool: pool, mapPoolPatch: patch },
        scope
      );
      if (!result.ok) {
        setErrors(result.fieldErrors);
        toast.error(t("saveFailed"));
        return;
      }
      toast.success(t("saveSuccess"));
    });
  }

  const poolError = errorText(t, "mapPool", errors.mapPool);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("settingsTitle")}</CardTitle>
        <CardDescription>{t("settingsDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>
              {t("firstMoverLabel")}
              <RequiredMark />
            </Label>
            <Select items={modeItems} value={mode} onValueChange={(v) => v && setMode(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {t(`mode.${m}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t(`modeHint.${mode}`)}</p>
            {errors.firstMoverMode && <p className="text-xs text-destructive">{t(`error.firstMoverMode.${errors.firstMoverMode}`)}</p>}
          </div>

          {mode === "advantage" && (
            <div className="flex flex-col gap-1.5">
              <Label>
                {t("advantageLabel")}
                <RequiredMark />
              </Label>
              <Select items={advantageItems} value={advantage} onValueChange={(v) => v && setAdvantage(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("advantageNone")}</SelectItem>
                  {data.entrants.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.advantageEntrantId && <p className="text-xs text-destructive">{t(`error.advantageEntrantId.${errors.advantageEntrantId}`)}</p>}
            </div>
          )}

          {mode === "predefined" && (
            <div className="flex flex-col gap-1.5">
              <Label>
                {t("slotLabel")}
                <RequiredMark />
              </Label>
              <Select items={slotItems} value={slot} onValueChange={(v) => v && setSlot(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a">{t("slotA")}</SelectItem>
                  <SelectItem value="b">{t("slotB")}</SelectItem>
                </SelectContent>
              </Select>
              {errors.predefinedSlot && <p className="text-xs text-destructive">{t(`error.predefinedSlot.${errors.predefinedSlot}`)}</p>}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="veto-timeout">
              {t("timeoutLabel")}
              <RequiredMark />
            </Label>
            <Input id="veto-timeout" type="number" inputMode="numeric" min={10} max={600} value={timeout} onChange={(e) => setTimeoutValue(e.target.value)} aria-invalid={!!errors.actionTimeoutSeconds} />
            <p className="text-xs text-muted-foreground">{t("timeoutHint")}</p>
            {errors.actionTimeoutSeconds && <p className="text-xs text-destructive">{t(`error.actionTimeoutSeconds.${errors.actionTimeoutSeconds}`)}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>
            {t("poolLabel")}
            <RequiredMark />
          </Label>
          <MapToggleGrid value={pool} onChange={setPool} />
          <p className="text-xs text-muted-foreground">{t("poolCount", { count: pool.length })}</p>
          {poolError && <p className="text-xs text-destructive">{poolError}</p>}
        </div>

        {pool.length === 0 && (
          <div className="flex max-w-xs flex-col gap-1.5">
            <Label htmlFor="veto-patch">
              {t("patchLabel")}
              <RequiredMark />
            </Label>
            <Input id="veto-patch" value={patch} onChange={(e) => setPatch(e.target.value)} placeholder="11.07" aria-invalid={!!errors.mapPoolPatch} />
            <p className="text-xs text-muted-foreground">{t("patchHint")}</p>
            {errors.mapPoolPatch && <p className="text-xs text-destructive">{t(`error.mapPoolPatch.${errors.mapPoolPatch}`)}</p>}
          </div>
        )}

        <div>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? t("saving") : t("saveButton")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TeamLinksCard({ data, scope }: { data: VetoManagementData; scope: Scope }) {
  const t = useTranslations("admin.vetoManagement");
  const locale = useLocale();
  const [tokens, setTokens] = useState<Record<number, string | null>>(() => Object.fromEntries(data.entrants.map((e) => [e.id, e.vetoToken])));
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<VetoManagedEntrant | null>(null);
  const [isPending, startTransition] = useTransition();

  const linkOf = (token: string) => `${window.location.origin}/${locale}/veto/${token}`;

  async function copy(entrantId: number, token: string) {
    try {
      await navigator.clipboard.writeText(linkOf(token));
      setCopiedId(entrantId);
      setTimeout(() => setCopiedId((current) => (current === entrantId ? null : current)), 2000);
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  function regenerate() {
    const entrant = confirming;
    if (!entrant) return;
    startTransition(async () => {
      const result = await regenerateTeamVetoLink(data.tournament.id, entrant.id, scope);
      setConfirming(null);
      if (!result.ok) {
        toast.error(t("error.notFound"));
        return;
      }
      setTokens((prev) => ({ ...prev, [entrant.id]: result.token }));
      toast.success(t("regenerated"));
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("linksTitle")}</CardTitle>
        <CardDescription>{t("linksDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {data.entrants.length === 0 && <p className="text-sm text-muted-foreground">{t("noEntrants")}</p>}
        {data.entrants.map((entrant) => {
          const token = tokens[entrant.id];
          return (
            <div key={entrant.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
              <span className="min-w-40 flex-1 truncate text-sm font-medium">{entrant.displayName}</span>
              {token ? (
                <>
                  <code className="hidden max-w-64 truncate rounded bg-muted px-2 py-1 text-xs md:block">{`/${locale}/veto/${token}`}</code>
                  <Button type="button" size="sm" variant="outline" onClick={() => copy(entrant.id, token)}>
                    {copiedId === entrant.id ? <Check /> : <Copy />}
                    {copiedId === entrant.id ? t("copied") : t("copyLink")}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(entrant)}>
                    <RefreshCw />
                    {t("regenerate")}
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-xs text-muted-foreground">{t("noLink")}</span>
                  <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => setConfirming(entrant)}>
                    <Link2 />
                    {t("generate")}
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </CardContent>
      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={t("regenerateTitle")}
        description={t("regenerateDescription", { team: confirming?.displayName ?? "" })}
        confirmLabel={t("regenerate")}
        cancelLabel={t("cancel")}
        onConfirm={regenerate}
        isPending={isPending}
      />
    </Card>
  );
}

function MatchesCard({ data, scope }: { data: VetoManagementData; scope: Scope }) {
  const t = useTranslations("admin.vetoManagement");
  const open = data.matches.filter((m) => m.status !== "completed");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("matchesTitle")}</CardTitle>
        <CardDescription>{t("matchesDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {open.length === 0 && <p className="text-sm text-muted-foreground">{t("noMatches")}</p>}
        {open.map((match) => (
          <MatchRow key={match.id} match={match} tournamentId={data.tournament.id} scope={scope} />
        ))}
      </CardContent>
    </Card>
  );
}

function MatchRow({ match, tournamentId, scope }: { match: VetoManagedMatch; tournamentId: number; scope: Scope }) {
  const t = useTranslations("admin.vetoManagement");
  const [pool, setPool] = useState<string[]>(match.matchPool);
  const [editing, setEditing] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [status, setStatus] = useState(match.vetoStatus);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const ready = match.entrantAName !== null && match.entrantBName !== null;

  function savePool() {
    setError(null);
    startTransition(async () => {
      const result = await saveMatchVetoPool(tournamentId, match.id, pool, scope);
      if (!result.ok) {
        setError(t(`error.matchPool.${result.error}`));
        return;
      }
      setEditing(false);
      toast.success(t("poolSaved"));
    });
  }

  async function copyOverlay() {
    try {
      await navigator.clipboard.writeText(`${WIDGETS_URL}/veto?match_id=${match.id}`);
      toast.success(t("overlayCopied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  function reset() {
    startTransition(async () => {
      const result = await resetMatchVeto(tournamentId, match.id, scope);
      setConfirmingReset(false);
      if (!result.ok) {
        toast.error(t("error.notFound"));
        return;
      }
      setStatus("waiting");
      toast.success(t("resetDone"));
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-48 flex-1 text-sm font-medium">{ready ? `${match.entrantAName} vs ${match.entrantBName}` : t("teamsUnknown")}</span>
        <Badge variant="outline">{`BO${match.bestOf}`}</Badge>
        <Badge variant="secondary">{t(`status.${status}`)}</Badge>
        <Button type="button" size="sm" variant="outline" onClick={copyOverlay}>
          <MonitorPlay />
          {t("copyOverlay")}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={!ready || isPending} onClick={() => setEditing((v) => !v)}>
          {t("editPool")}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={!ready || isPending || status === "waiting"} onClick={() => setConfirmingReset(true)}>
          <RotateCcw />
          {t("reset")}
        </Button>
      </div>
      {editing && (
        <div className="flex flex-col gap-2 border-t pt-3">
          <p className="text-xs text-muted-foreground">{t("matchPoolHint")}</p>
          <MapToggleGrid value={pool} onChange={setPool} disabled={isPending} />
          <p className="text-xs text-muted-foreground">{t("poolCount", { count: pool.length })}</p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" disabled={isPending} onClick={savePool}>
              {isPending ? t("saving") : t("saveButton")}
            </Button>
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => setPool([])}>
              {t("useTournamentPool")}
            </Button>
          </div>
        </div>
      )}
      <ConfirmDialog open={confirmingReset} onOpenChange={setConfirmingReset} title={t("resetTitle")} description={t("resetDescription")} confirmLabel={t("reset")} cancelLabel={t("cancel")} onConfirm={reset} isPending={isPending} />
    </div>
  );
}

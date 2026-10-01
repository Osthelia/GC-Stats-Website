/**
 * GC-Stats - org-vods-panel
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RequiredMark } from "@/components/admin/required-mark";
import { EntitySinglePicker } from "@/components/dashboard/news/entity-single-picker";
import type { EntityOption } from "@/components/dashboard/news/entity-multi-picker";
import type { OrganizationVodRow } from "@/lib/dashboard-vods-data";
import type { NewsLanguageOption } from "@/lib/news-languages";
import { useMatchTimeFilter } from "@/hooks/use-match-time-filter";
import { MatchTimeFilterBar } from "@/components/dashboard/match-time-filter-bar";
import {
  searchTournamentsForVod,
  getMatchOptionsForVod,
  getMapOptionsForVod,
  addVod,
  updateVod,
  deleteVod,
  type CreditMatchOption,
  type MatchMapOption,
  type VodFieldErrors,
} from "@/actions/dashboard-vods";

const NONE_MATCH = "__none__";
type Scope = "wholeMatch" | "map";

function VodRow({
  organizationId,
  canManage,
  vod,
  languages,
  onSaved,
  onDeleted,
}: {
  organizationId: number;
  canManage: boolean;
  vod: OrganizationVodRow;
  languages: NewsLanguageOption[];
  onSaved: (updated: OrganizationVodRow) => void;
  onDeleted: (id: number) => void;
}) {
  const t = useTranslations("dashboard.vods");
  const [isPending, startTransition] = useTransition();
  const [url, setUrl] = useState(vod.url);
  const [languageCode, setLanguageCode] = useState(vod.languageCode);
  const [fieldErrors, setFieldErrors] = useState<VodFieldErrors>({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const langItems = Object.fromEntries(languages.map((l) => [l.code, l.name]));
  const err = (field: keyof VodFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}` as "error.required") : undefined);

  function handleSave() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await updateVod(organizationId, vod.id, { url, languageCode });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      onSaved({ ...vod, url: url.trim(), languageCode });
      toast.success(t("saveSuccess"));
    });
  }

  function confirmDelete() {
    setDeleteConfirmOpen(false);
    startTransition(async () => {
      const result = await deleteVod(organizationId, vod.id);
      if (!result.ok) {
        toast.error(t("deleteError"));
        return;
      }
      onDeleted(vod.id);
      toast.success(t("deleteSuccess"));
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline">{vod.mapLabel ?? t("targetWholeMatch")}</Badge>
        <span className="text-sm font-medium">{vod.matchLabel}</span>
        <span className="text-xs text-muted-foreground">· {vod.tournamentName}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label className="text-[11px] text-muted-foreground">
            {t("urlLabel")}
            <RequiredMark />
          </Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} aria-invalid={!!fieldErrors.url} disabled={!canManage} />
          {err("url") && <p className="text-xs text-destructive">{err("url")}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[11px] text-muted-foreground">
            {t("languageLabel")}
            <RequiredMark />
          </Label>
          <Select items={langItems} value={languageCode} onValueChange={(v) => v && setLanguageCode(v)} disabled={!canManage}>
            <SelectTrigger aria-invalid={!!fieldErrors.languageCode} className="w-full">
              <SelectValue placeholder={t("languagePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {languages.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {err("languageCode") && <p className="text-xs text-destructive">{err("languageCode")}</p>}
        </div>
      </div>
      {canManage && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" disabled={isPending} onClick={handleSave}>
            {t("save")}
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
        description={t("deleteConfirm")}
        confirmLabel={t("deleteButton")}
        cancelLabel={t("cancel")}
        onConfirm={confirmDelete}
        isPending={isPending}
      />
    </div>
  );
}

function AddVodForm({ organizationId, languages, onAdded }: { organizationId: number; languages: NewsLanguageOption[]; onAdded: () => void }) {
  const t = useTranslations("dashboard.vods");
  const [isPending, startTransition] = useTransition();
  const [tournament, setTournament] = useState<EntityOption | null>(null);
  const [matchOptions, setMatchOptions] = useState<CreditMatchOption[]>([]);
  const [matchId, setMatchId] = useState<number | null>(null);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [scope, setScope] = useState<Scope>("wholeMatch");
  const [mapOptions, setMapOptions] = useState<MatchMapOption[]>([]);
  const [mapId, setMapId] = useState<number | null>(null);
  const [loadingMaps, setLoadingMaps] = useState(false);
  const [url, setUrl] = useState("");
  const [languageCode, setLanguageCode] = useState(languages[0]?.code ?? "");
  const [fieldErrors, setFieldErrors] = useState<VodFieldErrors>({});

  const scopeItems = { wholeMatch: t("scopeWholeMatch"), map: t("scopeMap") };
  const langItems = Object.fromEntries(languages.map((l) => [l.code, l.name]));
  const err = (field: keyof VodFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}` as "error.required") : undefined);

  useEffect(() => {
    setMatchId(null);
    setMapId(null);
    setMapOptions([]);
    if (!tournament) {
      setMatchOptions([]);
      return;
    }
    let cancelled = false;
    setLoadingMatches(true);
    getMatchOptionsForVod(organizationId, tournament.id).then((rows) => {
      if (cancelled) return;
      setMatchOptions(rows);
      setLoadingMatches(false);
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId, tournament]);

  useEffect(() => {
    setMapId(null);
    if (scope !== "map" || !matchId) {
      setMapOptions([]);
      return;
    }
    let cancelled = false;
    setLoadingMaps(true);
    getMapOptionsForVod(organizationId, matchId).then((rows) => {
      if (cancelled) return;
      setMapOptions(rows);
      setLoadingMaps(false);
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId, scope, matchId]);

  function handleAdd() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await addVod(organizationId, {
        tournamentId: tournament?.id ?? null,
        matchId,
        mapId: scope === "map" ? mapId : null,
        url,
        languageCode,
      });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      setTournament(null);
      setMatchId(null);
      setMapId(null);
      setUrl("");
      toast.success(t("addSuccess"));
      onAdded();
    });
  }

  const matchItems = { [NONE_MATCH]: loadingMatches ? t("matchLoading") : !tournament ? t("matchPickTournamentFirst") : t("matchPlaceholder"), ...Object.fromEntries(matchOptions.map((m) => [String(m.id), m.label])) };
  const mapItems = { [NONE_MATCH]: loadingMaps ? t("mapLoading") : t("mapPlaceholder"), ...Object.fromEntries(mapOptions.map((m) => [String(m.id), m.label])) };

  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <p className="text-sm font-medium">{t("addTitle")}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label>
            {t("tournamentLabel")}
            <RequiredMark />
          </Label>
          <EntitySinglePicker
            value={tournament}
            onChange={setTournament}
            search={(q) => searchTournamentsForVod(organizationId, q).then((rows) => rows.map((r) => ({ id: r.id, label: r.name })))}
            placeholder={t("tournamentPlaceholder")}
            searchPlaceholder={t("tournamentSearchPlaceholder")}
            noResultsLabel={t("tournamentNoResults")}
            clearLabel={t("clear")}
          />
          {err("tournament") && <p className="text-xs text-destructive">{err("tournament")}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>
            {t("matchLabel")}
            <RequiredMark />
          </Label>
          <Select items={matchItems} value={matchId !== null ? String(matchId) : NONE_MATCH} onValueChange={(v) => setMatchId(v && v !== NONE_MATCH ? Number(v) : null)} disabled={!tournament || loadingMatches}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_MATCH}>{matchItems[NONE_MATCH]}</SelectItem>
              {matchOptions.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {err("match") && <p className="text-xs text-destructive">{err("match")}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>
            {t("scopeLabel")}
            <RequiredMark />
          </Label>
          <Select items={scopeItems} value={scope} onValueChange={(v) => v && setScope(v as Scope)} disabled={!matchId}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="wholeMatch">{scopeItems.wholeMatch}</SelectItem>
              <SelectItem value="map">{scopeItems.map}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {scope === "map" && (
          <div className="flex flex-col gap-1.5">
            <Label>
              {t("mapLabel")}
              <RequiredMark />
            </Label>
            <Select items={mapItems} value={mapId !== null ? String(mapId) : NONE_MATCH} onValueChange={(v) => setMapId(v && v !== NONE_MATCH ? Number(v) : null)} disabled={loadingMaps}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_MATCH}>{mapItems[NONE_MATCH]}</SelectItem>
                {mapOptions.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {err("map") && <p className="text-xs text-destructive">{err("map")}</p>}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label>
            {t("urlLabel")}
            <RequiredMark />
          </Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("urlPlaceholder")} aria-invalid={!!fieldErrors.url} />
          {err("url") && <p className="text-xs text-destructive">{err("url")}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>
            {t("languageLabel")}
            <RequiredMark />
          </Label>
          <Select items={langItems} value={languageCode} onValueChange={(v) => v && setLanguageCode(v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("languagePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {languages.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {err("languageCode") && <p className="text-xs text-destructive">{err("languageCode")}</p>}
        </div>
        <div className="flex items-end">
          <Button variant="outline" disabled={isPending} onClick={handleAdd} className="w-full">
            {t("addSubmit")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function OrgVodsPanel({ organizationId, initialVods, languages, canManage }: { organizationId: number; initialVods: OrganizationVodRow[]; languages: NewsLanguageOption[]; canManage: boolean }) {
  const t = useTranslations("dashboard.vods");
  const router = useRouter();
  const [vods, setVods] = useState(initialVods);
  const vodsFilter = useMatchTimeFilter(vods, (v) => v.scheduledAt, "past");

  return (
    <div className="flex flex-col gap-4">
      {!canManage && <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{t("readOnlyHint")}</p>}

      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {vods.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
          {vods.length > 0 && (
            <MatchTimeFilterBar
              showAll={vodsFilter.showAll}
              onShowAllChange={vodsFilter.setShowAll}
              defaultFilterLabel={t("filterPast")}
              allLabel={t("filterAll")}
              page={vodsFilter.page}
              totalPages={vodsFilter.totalPages}
              onPageChange={vodsFilter.setPage}
              previousLabel={t("previous")}
              nextLabel={t("next")}
              pageOfLabel={t("pageOf", { page: vodsFilter.page, total: vodsFilter.totalPages })}
            />
          )}
          {vods.length > 0 && vodsFilter.pageItems.length === 0 && <p className="text-sm text-muted-foreground">{t("filterEmpty")}</p>}
          <div className="flex flex-col gap-3">
            {vodsFilter.pageItems.map((v) => (
              <VodRow
                key={v.id}
                organizationId={organizationId}
                canManage={canManage}
                vod={v}
                languages={languages}
                onSaved={(updated) => setVods((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))}
                onDeleted={(id) => setVods((prev) => prev.filter((x) => x.id !== id))}
              />
            ))}
          </div>
          {canManage && <AddVodForm organizationId={organizationId} languages={languages} onAdded={() => router.refresh()} />}
        </CardContent>
      </Card>
    </div>
  );
}

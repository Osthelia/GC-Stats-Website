/**
 * GC-Stats - org-streams-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RequiredMark } from "@/components/admin/required-mark";
import { EntitySinglePicker } from "@/components/dashboard/news/entity-single-picker";
import type { EntityOption } from "@/components/dashboard/news/entity-multi-picker";
import { STREAM_PLATFORMS, STREAM_CHANNEL_TYPES } from "@/lib/stream-platforms";
import type { OrganizationStreamChannelRow, OrganizationStreamLink } from "@/lib/dashboard-streams-data";
import type { NewsLanguageOption } from "@/lib/news-languages";
import { useMatchTimeFilter } from "@/hooks/use-match-time-filter";
import { MatchTimeFilterBar } from "@/components/dashboard/match-time-filter-bar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  createStreamChannel,
  updateStreamChannel,
  deleteStreamChannel,
  searchTournamentsForStreamLink,
  getMatchOptionsForStreamLink,
  linkStreamChannelToMatches,
  unlinkStreamChannelFromMatch,
  type StreamChannelInput,
  type StreamChannelFieldErrors,
  type CreditMatchOption,
} from "@/actions/dashboard-streams";

const NONE_MATCH = "__none__";

function platformItems(t: ReturnType<typeof useTranslations>): Record<string, string> {
  return Object.fromEntries(STREAM_PLATFORMS.map((p) => [p, t(`platform.${p}` as "platform.twitch")]));
}

function typeItems(t: ReturnType<typeof useTranslations>): Record<string, string> {
  return Object.fromEntries(STREAM_CHANNEL_TYPES.map((v) => [v, t(`type.${v}` as "type.official")]));
}

function TypeField({ value, onChange, items, error, disabled, compact }: { value: string; onChange: (v: string) => void; items: Record<string, string>; error?: string; disabled?: boolean; compact?: boolean }) {
  const t = useTranslations("dashboard.streams");
  return (
    <div className={`flex flex-col ${compact ? "gap-1" : "gap-1.5"}`}>
      <Label className={compact ? "text-[11px] text-muted-foreground" : undefined}>
        {t("typeLabel")}
        <RequiredMark />
      </Label>
      <Select items={items} value={value} onValueChange={(v) => v && onChange(v)} disabled={disabled}>
        <SelectTrigger aria-invalid={!!error} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STREAM_CHANNEL_TYPES.map((v) => (
            <SelectItem key={v} value={v}>
              {items[v]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function ChannelRow({
  organizationId,
  canEdit,
  canDelete,
  channel,
  languages,
  onSaved,
  onDeleted,
}: {
  organizationId: number;
  canEdit: boolean;
  canDelete: boolean;
  channel: OrganizationStreamChannelRow;
  languages: NewsLanguageOption[];
  onSaved: (updated: OrganizationStreamChannelRow) => void;
  onDeleted: (id: number) => void;
}) {
  const t = useTranslations("dashboard.streams");
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<StreamChannelInput>({ name: channel.name, platform: channel.platform, type: channel.type, url: channel.url, languageCode: channel.languageCode, isActive: channel.isActive });
  const [fieldErrors, setFieldErrors] = useState<StreamChannelFieldErrors>({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const set = <K extends keyof StreamChannelInput>(key: K, value: StreamChannelInput[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const platItems = platformItems(t);
  const typItems = typeItems(t);
  const langItems = Object.fromEntries(languages.map((l) => [l.code, l.name]));
  const err = (field: keyof StreamChannelFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}` as "error.required") : undefined);

  function handleSave() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await updateStreamChannel(organizationId, channel.id, form);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      onSaved({ id: channel.id, name: form.name.trim(), platform: form.platform, type: form.type, url: form.url.trim(), languageCode: form.languageCode, isActive: form.isActive });
      toast.success(t("saveSuccess"));
    });
  }

  function confirmDelete() {
    setDeleteConfirmOpen(false);
    startTransition(async () => {
      const result = await deleteStreamChannel(organizationId, channel.id);
      if (!result.ok) {
        toast.error(t("deleteError"));
        return;
      }
      onDeleted(channel.id);
      toast.success(t("deleteSuccess"));
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-1">
          <Label className="text-[11px] text-muted-foreground">
            {t("nameLabel")}
            <RequiredMark />
          </Label>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!fieldErrors.name} disabled={!canEdit} />
          {err("name") && <p className="text-xs text-destructive">{err("name")}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[11px] text-muted-foreground">
            {t("platformLabel")}
            <RequiredMark />
          </Label>
          <Select items={platItems} value={form.platform} onValueChange={(v) => v && set("platform", v)} disabled={!canEdit}>
            <SelectTrigger aria-invalid={!!fieldErrors.platform} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STREAM_PLATFORMS.map((p) => (
                <SelectItem key={p} value={p}>
                  {platItems[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {err("platform") && <p className="text-xs text-destructive">{err("platform")}</p>}
        </div>
        <TypeField value={form.type} onChange={(v) => set("type", v)} items={typItems} error={err("type")} disabled={!canEdit} compact />
        <div className="flex flex-col gap-1">
          <Label className="text-[11px] text-muted-foreground">
            {t("urlLabel")}
            <RequiredMark />
          </Label>
          <Input value={form.url} onChange={(e) => set("url", e.target.value)} aria-invalid={!!fieldErrors.url} disabled={!canEdit} />
          {err("url") && <p className="text-xs text-destructive">{err("url")}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[11px] text-muted-foreground">
            {t("languageLabel")}
            <RequiredMark />
          </Label>
          <Select items={langItems} value={form.languageCode} onValueChange={(v) => v && set("languageCode", v)} disabled={!canEdit}>
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

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={form.isActive} onCheckedChange={(checked) => set("isActive", checked === true)} disabled={!canEdit} />
          {t("activeLabel")}
        </label>
        {(canEdit || canDelete) && (
          <div className="flex gap-2">
            {canEdit && (
              <Button variant="outline" size="sm" disabled={isPending} onClick={handleSave}>
                {t("save")}
              </Button>
            )}
            {canDelete && (
              <Button variant="ghost" size="sm" disabled={isPending} onClick={() => setDeleteConfirmOpen(true)} className="text-destructive hover:text-destructive">
                {t("deleteButton")}
              </Button>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={t("deleteButton")}
        description={t("deleteConfirm", { name: channel.name })}
        confirmLabel={t("deleteButton")}
        cancelLabel={t("cancel")}
        onConfirm={confirmDelete}
        isPending={isPending}
      />
    </div>
  );
}

function AddChannelForm({ organizationId, languages, onAdded }: { organizationId: number; languages: NewsLanguageOption[]; onAdded: () => void }) {
  const t = useTranslations("dashboard.streams");
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<StreamChannelInput>({ name: "", platform: STREAM_PLATFORMS[0], type: STREAM_CHANNEL_TYPES[0], url: "", languageCode: languages[0]?.code ?? "", isActive: true });
  const [fieldErrors, setFieldErrors] = useState<StreamChannelFieldErrors>({});

  const set = <K extends keyof StreamChannelInput>(key: K, value: StreamChannelInput[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const platItems = platformItems(t);
  const typItems = typeItems(t);
  const langItems = Object.fromEntries(languages.map((l) => [l.code, l.name]));
  const err = (field: keyof StreamChannelFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}` as "error.required") : undefined);

  function handleAdd() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await createStreamChannel(organizationId, form);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      setForm({ name: "", platform: STREAM_PLATFORMS[0], type: STREAM_CHANNEL_TYPES[0], url: "", languageCode: languages[0]?.code ?? "", isActive: true });
      toast.success(t("addSuccess"));
      onAdded();
    });
  }

  return (
    <div className="flex flex-col gap-3 border-b pb-4">
      <p className="text-sm font-medium">{t("addTitle")}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-1.5">
          <Label>
            {t("nameLabel")}
            <RequiredMark />
          </Label>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={t("namePlaceholder")} aria-invalid={!!fieldErrors.name} />
          {err("name") && <p className="text-xs text-destructive">{err("name")}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>
            {t("platformLabel")}
            <RequiredMark />
          </Label>
          <Select items={platItems} value={form.platform} onValueChange={(v) => v && set("platform", v)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STREAM_PLATFORMS.map((p) => (
                <SelectItem key={p} value={p}>
                  {platItems[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {err("platform") && <p className="text-xs text-destructive">{err("platform")}</p>}
        </div>
        <TypeField value={form.type} onChange={(v) => set("type", v)} items={typItems} error={err("type")} />
        <div className="flex flex-col gap-1.5">
          <Label>
            {t("urlLabel")}
            <RequiredMark />
          </Label>
          <Input value={form.url} onChange={(e) => set("url", e.target.value)} placeholder={t("urlPlaceholder")} aria-invalid={!!fieldErrors.url} />
          {err("url") && <p className="text-xs text-destructive">{err("url")}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>
            {t("languageLabel")}
            <RequiredMark />
          </Label>
          <Select items={langItems} value={form.languageCode} onValueChange={(v) => v && set("languageCode", v)}>
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

function AddLinkForm({ organizationId, channels, onAdded }: { organizationId: number; channels: OrganizationStreamChannelRow[]; onAdded: () => void }) {
  const t = useTranslations("dashboard.streams");
  const [isPending, startTransition] = useTransition();
  const [channelId, setChannelId] = useState<string>(channels[0] ? String(channels[0].id) : NONE_MATCH);
  const [tournament, setTournament] = useState<EntityOption | null>(null);
  const [matchOptions, setMatchOptions] = useState<CreditMatchOption[]>([]);
  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<number>>(new Set());
  const [matchFilter, setMatchFilter] = useState("");
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const channelItems = Object.fromEntries(channels.map((c) => [String(c.id), c.name]));

  useEffect(() => {
    setSelectedMatchIds(new Set());
    setMatchFilter("");
    if (!tournament) {
      setMatchOptions([]);
      return;
    }
    let cancelled = false;
    setLoadingMatches(true);
    getMatchOptionsForStreamLink(organizationId, tournament.id).then((rows) => {
      if (cancelled) return;
      setMatchOptions(rows);
      setLoadingMatches(false);
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId, tournament]);

  const visibleMatches = matchOptions.filter((m) => m.label.toLowerCase().includes(matchFilter.toLowerCase()));

  function toggleMatch(id: number) {
    setSelectedMatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleLink() {
    setError(null);
    if (channelId === NONE_MATCH || !tournament || selectedMatchIds.size === 0) return;
    startTransition(async () => {
      const result = await linkStreamChannelToMatches(organizationId, Number(channelId), tournament.id, [...selectedMatchIds]);
      if (!result.ok) {
        setError(t(`error.${result.error}` as "error.channelNotFound"));
        return;
      }
      setSelectedMatchIds(new Set());
      toast.success(t("linkManySuccess", { linked: result.linked, alreadyLinked: result.alreadyLinked }));
      onAdded();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">{t("linksTitle")}</p>
      <p className="text-sm text-muted-foreground">{t("linksHint")}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>
            {t("channelLabel")}
            <RequiredMark />
          </Label>
          <Select items={channelItems} value={channelId} onValueChange={(v) => v && setChannelId(v)} disabled={channels.length === 0}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("channelPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {channels.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
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
            search={(q) => searchTournamentsForStreamLink(organizationId, q).then((rows) => rows.map((r) => ({ id: r.id, label: r.name })))}
            placeholder={t("tournamentPlaceholder")}
            searchPlaceholder={t("tournamentSearchPlaceholder")}
            noResultsLabel={t("tournamentNoResults")}
            clearLabel={t("clear")}
          />
        </div>
      </div>

      {tournament && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>
              {t("matchLabel")}
              <RequiredMark />
            </Label>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{t("matchSelectedCount", { count: selectedMatchIds.size })}</span>
              <button type="button" onClick={() => setSelectedMatchIds(new Set(visibleMatches.map((m) => m.id)))} className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                {t("matchSelectAll")}
              </button>
              <button type="button" onClick={() => setSelectedMatchIds(new Set())} className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                {t("matchClearSelection")}
              </button>
            </div>
          </div>
          <Input value={matchFilter} onChange={(e) => setMatchFilter(e.target.value)} placeholder={t("matchSearchPlaceholder")} />
          <div className="max-h-64 overflow-y-auto rounded-lg border">
            {loadingMatches && <p className="p-3 text-sm text-muted-foreground">{t("matchLoading")}</p>}
            {!loadingMatches && visibleMatches.length === 0 && <p className="p-3 text-sm text-muted-foreground">{t("matchPlaceholder")}</p>}
            {!loadingMatches &&
              visibleMatches.map((m) => (
                <label key={m.id} className="flex cursor-pointer items-center gap-2 border-b px-3 py-2 text-sm last:border-0 hover:bg-accent/40">
                  <Checkbox checked={selectedMatchIds.has(m.id)} onCheckedChange={() => toggleMatch(m.id)} />
                  <span className="truncate">{m.label}</span>
                </label>
              ))}
          </div>
        </div>
      )}

      <div>
        <Button variant="outline" disabled={isPending || channels.length === 0 || !tournament || selectedMatchIds.size === 0} onClick={handleLink}>
          {t("linkSubmit")}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function OrgStreamsPanel({
  organizationId,
  initialChannels,
  initialLinks,
  languages,
  canView,
  canEdit,
  canDelete,
  canLink,
}: {
  organizationId: number;
  initialChannels: OrganizationStreamChannelRow[];
  initialLinks: OrganizationStreamLink[];
  languages: NewsLanguageOption[];
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canLink: boolean;
}) {
  const t = useTranslations("dashboard.streams");
  const [channels, setChannels] = useState(initialChannels);
  const [links, setLinks] = useState(initialLinks);
  const [isPending, startTransition] = useTransition();
  const canManageChannel = canEdit || canDelete;
  const linksFilter = useMatchTimeFilter(links, (l) => l.scheduledAt, "upcoming");
  const [unlinking, setUnlinking] = useState<OrganizationStreamLink | null>(null);

  function confirmUnlink() {
    if (!unlinking) return;
    const link = unlinking;
    setUnlinking(null);
    startTransition(async () => {
      const result = await unlinkStreamChannelFromMatch(organizationId, link.channelId, link.matchId);
      if (!result.ok) {
        toast.error(t("unlinkError"));
        return;
      }
      setLinks((prev) => prev.filter((l) => !(l.channelId === link.channelId && l.matchId === link.matchId)));
      toast.success(t("unlinkSuccess"));
    });
  }

  if (!canView) return <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{t("readOnlyHint")}</p>;

  return (
    <div className="flex flex-col gap-4">
      {!canManageChannel && <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{t("readOnlyHint")}</p>}

      <Card>
        <CardHeader>
          <CardTitle>{t("channelsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {canEdit && <AddChannelForm organizationId={organizationId} languages={languages} onAdded={() => window.location.reload()} />}
          {channels.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
          <div className="flex flex-col gap-3">
            {channels.map((c) => (
              <ChannelRow
                key={c.id}
                organizationId={organizationId}
                canEdit={canEdit}
                canDelete={canDelete}
                channel={c}
                languages={languages}
                onSaved={(updated) => setChannels((prev) => prev.map((ch) => (ch.id === updated.id ? updated : ch)))}
                onDeleted={(id) => setChannels((prev) => prev.filter((ch) => ch.id !== id))}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {canLink && (
        <Card>
          <CardHeader>
            <CardTitle>{t("linksTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <AddLinkForm organizationId={organizationId} channels={channels} onAdded={() => window.location.reload()} />
            <div className="flex flex-col gap-4 border-t pt-4">
              {links.length === 0 && <p className="text-sm text-muted-foreground">{t("linkEmpty")}</p>}
              {links.length > 0 && (
                <MatchTimeFilterBar
                  showAll={linksFilter.showAll}
                  onShowAllChange={linksFilter.setShowAll}
                  defaultFilterLabel={t("filterUpcoming")}
                  allLabel={t("filterAll")}
                  page={linksFilter.page}
                  totalPages={linksFilter.totalPages}
                  onPageChange={linksFilter.setPage}
                  previousLabel={t("previous")}
                  nextLabel={t("next")}
                  pageOfLabel={t("pageOf", { page: linksFilter.page, total: linksFilter.totalPages })}
                />
              )}
              {links.length > 0 && linksFilter.pageItems.length === 0 && <p className="text-sm text-muted-foreground">{t("linkFilterEmpty")}</p>}
              {linksFilter.pageItems.length > 0 && (
                <div className="flex flex-col gap-2">
                  {linksFilter.pageItems.map((l) => (
                    <div key={`${l.channelId}-${l.matchId}`} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline">{l.channelName}</Badge>
                          <span className="truncate text-sm font-medium">{l.matchLabel}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{l.tournamentName}</span>
                      </div>
                      <Button variant="ghost" size="sm" disabled={isPending} onClick={() => setUnlinking(l)} className="shrink-0 text-destructive hover:text-destructive">
                        {t("unlinkButton")}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={unlinking !== null}
        onOpenChange={(next) => {
          if (!next) setUnlinking(null);
        }}
        title={t("unlinkButton")}
        description={t("unlinkConfirm")}
        confirmLabel={t("unlinkButton")}
        cancelLabel={t("cancel")}
        onConfirm={confirmUnlink}
        isPending={isPending}
      />
    </div>
  );
}

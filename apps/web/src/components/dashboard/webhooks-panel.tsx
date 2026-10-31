/**
 * GC-Stats - webhooks-panel
 *
 * Webhook endpoints of a partner API key, on its dashboard page.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Copy, Eye, Pencil, Plus, RefreshCw, RotateCw, Send, Trash2, Webhook, X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormField } from "@/components/admin/form-field";
import { TeamPicker } from "@/components/admin/team-picker";
import { FormattedDate } from "@/components/formatted-date";
import {
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  redeliverWebhook,
  revealWebhookSecret,
  rotateWebhookSecret,
  searchWebhookTeams,
  sendWebhookTest,
  setWebhookEndpointActive,
  updateWebhookEndpoint,
  type WebhookFieldErrors,
  type WebhookSendResult,
} from "@/actions/webhooks";
import {
  WEBHOOK_EVENTS,
  WEBHOOK_LIMITS,
  WEBHOOK_OFFICIAL_FILTERS,
  type WebhookDeliveryView,
  type WebhookEndpointView,
  type WebhookEvent,
  type WebhookKeyScope,
  type WebhookOfficialFilter,
} from "@/lib/webhooks/shared";

type FormState = {
  url: string;
  description: string;
  events: WebhookEvent[];
  filterRegions: string[];
  filterTeams: { id: number; name: string }[];
  filterOfficial: WebhookOfficialFilter;
};

const EMPTY_FORM: FormState = { url: "", description: "", events: [...WEBHOOK_EVENTS], filterRegions: [], filterTeams: [], filterOfficial: "all" };

const DELIVERY_STATUS_CLASS: Record<string, string> = {
  success: "bg-emerald-500/15 text-emerald-500",
  pending: "bg-amber-500/15 text-amber-500",
  failed: "bg-destructive/15 text-destructive",
};

function SecretBox({ secret }: { secret: string }) {
  const t = useTranslations("dashboard.webhooks");
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 overflow-x-auto rounded-md border bg-muted px-3 py-2 font-mono text-xs">{secret}</code>
      <Button type="button" variant="outline" size="icon" onClick={handleCopy} aria-label={t("copySecret")}>
        {copied ? <Check className="text-emerald-500" /> : <Copy />}
      </Button>
    </div>
  );
}

function EndpointDialog({
  scope,
  regions,
  editing,
  open,
  onOpenChange,
  onCreated,
}: {
  scope: WebhookKeyScope;
  regions: string[];
  editing: WebhookEndpointView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (secret: string) => void;
}) {
  const t = useTranslations("dashboard.webhooks");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(
    editing
      ? { url: editing.url, description: editing.description ?? "", events: editing.events, filterRegions: editing.filterRegions, filterTeams: editing.filterTeams, filterOfficial: editing.filterOfficial }
      : EMPTY_FORM,
  );
  const [fieldErrors, setFieldErrors] = useState<WebhookFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  const err = (field: keyof WebhookFieldErrors) => (fieldErrors[field] ? t(`error.${field}.${fieldErrors[field]}`, { ...WEBHOOK_LIMITS }) : undefined);

  const officialItems = Object.fromEntries(WEBHOOK_OFFICIAL_FILTERS.map((v) => [v, t(`official.${v}`)]));

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);
    startTransition(async () => {
      const input = {
        url: form.url,
        description: form.description,
        events: form.events,
        filterRegions: form.filterRegions,
        filterTeamIds: form.filterTeams.map((team) => team.id),
        filterOfficial: form.filterOfficial,
      };
      try {
        const result = editing ? await updateWebhookEndpoint(scope, editing.id, input) : await createWebhookEndpoint(scope, input);
        if (!result.ok) {
          if (result.fieldErrors) setFieldErrors(result.fieldErrors);
          setFormError(t(`error.${result.error}`, { max: WEBHOOK_LIMITS.endpointsPerKey }));
          return;
        }
        toast.success(editing ? t("updated") : t("created"));
        onOpenChange(false);
        if (result.secret) onCreated(result.secret);
        router.refresh();
      } catch {
        setFormError(t("error.network"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{editing ? t("editTitle") : t("addTitle")}</DialogTitle>
            <DialogDescription>{t("dialogDescription")}</DialogDescription>
          </DialogHeader>

          <FormField label={t("url")} htmlFor="wh-url" required error={err("url")} hint={t("urlHint")}>
            <Input id="wh-url" value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://example.com/webhooks/gcs" maxLength={WEBHOOK_LIMITS.urlMaxLength} aria-invalid={!!fieldErrors.url} />
          </FormField>

          <FormField label={t("descriptionLabel")} htmlFor="wh-description" error={err("description")}>
            <Input id="wh-description" value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={WEBHOOK_LIMITS.descriptionMaxLength} aria-invalid={!!fieldErrors.description} />
          </FormField>

          <FormField label={t("events")} htmlFor="wh-events" required error={err("events")}>
            <div id="wh-events" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {WEBHOOK_EVENTS.map((event) => (
                <label key={event} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted active:bg-muted/70">
                  <Checkbox checked={form.events.includes(event)} onCheckedChange={() => set("events", toggle(form.events, event))} />
                  <span className="flex flex-col">
                    <span className="font-medium">{t(`event.${event}`)}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{event}</span>
                  </span>
                </label>
              ))}
            </div>
          </FormField>

          <div className="flex flex-col gap-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">{t("filtersTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("filtersHint")}</p>
            </div>

            <FormField label={t("official.label")} htmlFor="wh-official" error={err("filterOfficial")}>
              <Select items={officialItems} value={form.filterOfficial} onValueChange={(v) => v && set("filterOfficial", v as WebhookOfficialFilter)}>
                <SelectTrigger id="wh-official" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEBHOOK_OFFICIAL_FILTERS.map((v) => (
                    <SelectItem key={v} value={v}>
                      {officialItems[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label={t("regions")} htmlFor="wh-regions" error={err("filterRegions")} hint={t("regionsHint")}>
              <div id="wh-regions" className="flex flex-wrap gap-1.5">
                {regions.map((region) => {
                  const on = form.filterRegions.includes(region);
                  return (
                    <button
                      key={region}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set("filterRegions", toggle(form.filterRegions, region))}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-all active:scale-95 ${on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    >
                      {region}
                    </button>
                  );
                })}
              </div>
            </FormField>

            <FormField label={t("teams")} htmlFor="wh-teams" error={err("filterTeamIds")} hint={t("teamsHint")}>
              <div className="flex flex-col gap-2">
                {form.filterTeams.length < WEBHOOK_LIMITS.filterTeams && (
                  <TeamPicker
                    id="wh-teams"
                    value={null}
                    onChange={(team) => team && !form.filterTeams.some((x) => x.id === team.id) && set("filterTeams", [...form.filterTeams, team])}
                    placeholder={t("teamsPlaceholder")}
                    searchPlaceholder={t("teamsSearch")}
                    noResultsLabel={t("teamsNoResults")}
                    search={searchWebhookTeams}
                  />
                )}
                {form.filterTeams.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {form.filterTeams.map((team) => (
                      <Badge key={team.id} variant="secondary" className="gap-1 pr-1">
                        {team.name}
                        <button
                          type="button"
                          onClick={() => set("filterTeams", form.filterTeams.filter((x) => x.id !== team.id))}
                          aria-label={t("removeTeam", { name: team.name })}
                          className="rounded-sm p-0.5 transition-colors hover:bg-background/60 active:bg-background"
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </FormField>
          </div>

          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function WebhooksPanel({
  scope,
  endpoints,
  deliveries,
  regions,
  keyActive,
}: {
  scope: WebhookKeyScope;
  endpoints: WebhookEndpointView[];
  deliveries: WebhookDeliveryView[];
  regions: string[];
  keyActive: boolean;
}) {
  const t = useTranslations("dashboard.webhooks");
  const router = useRouter();
  const [dialog, setDialog] = useState<{ editing: WebhookEndpointView | null } | null>(null);
  const [secret, setSecret] = useState<{ title: string; value: string } | null>(null);
  const [deleting, setDeleting] = useState<WebhookEndpointView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const endpointUrl = new Map(endpoints.map((e) => [e.id, e.url]));

  async function run<T>(key: string, action: () => Promise<T>): Promise<T | null> {
    setBusy(key);
    try {
      return await action();
    } catch {
      toast.error(t("error.network"));
      return null;
    } finally {
      setBusy(null);
    }
  }

  function reportSend(result: WebhookSendResult | null) {
    if (!result) return;
    if (!result.ok) toast.error(t(`error.${result.error}`));
    else if (result.delivered) toast.success(t("testSuccess", { status: result.statusCode ?? 0 }));
    else toast.error(t("testFailed", { error: result.error ?? "-" }));
    router.refresh();
  }

  async function handleToggle(endpoint: WebhookEndpointView) {
    const result = await run(`toggle-${endpoint.id}`, () => setWebhookEndpointActive(scope, endpoint.id, !endpoint.isActive));
    if (result && !result.ok) toast.error(t("error.notFound"));
    else if (result) router.refresh();
  }

  async function handleReveal(endpoint: WebhookEndpointView) {
    const result = await run(`reveal-${endpoint.id}`, () => revealWebhookSecret(scope, endpoint.id));
    if (result?.ok) setSecret({ title: t("secretTitle"), value: result.secret });
    else if (result) toast.error(t("error.notFound"));
  }

  async function handleRotate(endpoint: WebhookEndpointView) {
    const result = await run(`rotate-${endpoint.id}`, () => rotateWebhookSecret(scope, endpoint.id));
    if (result?.ok) setSecret({ title: t("secretRotatedTitle"), value: result.secret });
    else if (result) toast.error(t("error.notFound"));
  }

  async function handleDelete() {
    if (!deleting) return;
    const target = deleting;
    const result = await run(`delete-${target.id}`, () => deleteWebhookEndpoint(scope, target.id));
    setDeleting(null);
    if (result?.ok) {
      toast.success(t("deleted"));
      router.refresh();
    } else if (result) toast.error(t("error.notFound"));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="size-4" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
        <CardAction className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.refresh()} aria-label={t("refresh")}>
            <RefreshCw />
          </Button>
          <Button size="sm" onClick={() => setDialog({ editing: null })} disabled={!keyActive || endpoints.length >= WEBHOOK_LIMITS.endpointsPerKey}>
            <Plus />
            {t("add")}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {!keyActive && <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">{t("keyInactive")}</p>}

        {endpoints.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {endpoints.map((endpoint) => (
              <div key={endpoint.id} className="flex flex-col gap-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-sm">{endpoint.url}</p>
                    {endpoint.description && <p className="text-xs text-muted-foreground">{endpoint.description}</p>}
                    {endpoint.disabledReason === "failing" && !endpoint.isActive && <p className="mt-1 text-xs text-destructive">{t("disabledFailing")}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{endpoint.isActive ? t("active") : t("inactive")}</span>
                    <Switch checked={endpoint.isActive} onCheckedChange={() => handleToggle(endpoint)} disabled={busy === `toggle-${endpoint.id}`} aria-label={t("toggle")} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {endpoint.events.map((event) => (
                    <Badge key={event} variant="outline" className="font-mono text-[11px]">
                      {event}
                    </Badge>
                  ))}
                </div>

                <dl className="grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                  <div>
                    <dt className="inline font-medium text-foreground">{t("official.label")}: </dt>
                    <dd className="inline">{t(`official.${endpoint.filterOfficial}`)}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-foreground">{t("regions")}: </dt>
                    <dd className="inline">{endpoint.filterRegions.length ? endpoint.filterRegions.join(", ") : t("any")}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-foreground">{t("teams")}: </dt>
                    <dd className="inline">{endpoint.filterTeams.length ? endpoint.filterTeams.map((team) => team.name).join(", ") : t("any")}</dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={async () => reportSend(await run(`test-${endpoint.id}`, () => sendWebhookTest(scope, endpoint.id)))} disabled={busy === `test-${endpoint.id}`}>
                    <Send />
                    {busy === `test-${endpoint.id}` ? t("testing") : t("test")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDialog({ editing: endpoint })}>
                    <Pencil />
                    {t("edit")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleReveal(endpoint)} disabled={busy === `reveal-${endpoint.id}`}>
                    <Eye />
                    {t("showSecret")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleRotate(endpoint)} disabled={busy === `rotate-${endpoint.id}`}>
                    <RotateCw />
                    {t("rotateSecret")}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setDeleting(endpoint)}>
                    <Trash2 />
                    {t("delete")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t("deliveriesTitle")}</h3>
          {deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("deliveriesEmpty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columnDate")}</TableHead>
                  <TableHead>{t("columnEvent")}</TableHead>
                  <TableHead>{t("columnEndpoint")}</TableHead>
                  <TableHead>{t("columnStatus")}</TableHead>
                  <TableHead>{t("columnAttempts")}</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      <FormattedDate date={d.createdAt} mode="datetime" />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {d.eventType}
                      {d.entityId != null && <span className="text-muted-foreground"> #{d.entityId}</span>}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate font-mono text-xs text-muted-foreground">{endpointUrl.get(d.endpointId) ?? "-"}</TableCell>
                    <TableCell>
                      <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${DELIVERY_STATUS_CLASS[d.status] ?? ""}`}>{t(`status.${d.status}`)}</span>
                      {(d.lastStatusCode != null || d.lastError) && d.status !== "success" && (
                        <span className="ml-1.5 text-xs text-muted-foreground">{d.lastError ?? d.lastStatusCode}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">{d.attempts}</TableCell>
                    <TableCell className="text-right">
                      {d.status !== "pending" && (
                        <Button variant="ghost" size="xs" onClick={async () => reportSend(await run(`redeliver-${d.id}`, () => redeliverWebhook(scope, d.id)))} disabled={busy === `redeliver-${d.id}`}>
                          <RotateCw />
                          {t("redeliver")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>

      {dialog && (
        <EndpointDialog
          key={dialog.editing?.id ?? "new"}
          scope={scope}
          regions={regions}
          editing={dialog.editing}
          open
          onOpenChange={(open) => !open && setDialog(null)}
          onCreated={(value) => setSecret({ title: t("secretCreatedTitle"), value })}
        />
      )}

      <Dialog open={!!secret} onOpenChange={(open) => !open && setSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{secret?.title}</DialogTitle>
            <DialogDescription>{t("secretDescription")}</DialogDescription>
          </DialogHeader>
          {secret && <SecretBox secret={secret.value} />}
          <DialogFooter>
            <Button onClick={() => setSecret(null)}>{t("close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("deleteTitle")}
        description={t("deleteDescription", { url: deleting?.url ?? "" })}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        onConfirm={handleDelete}
        isPending={busy?.startsWith("delete-") ?? false}
        destructive
      />
    </Card>
  );
}

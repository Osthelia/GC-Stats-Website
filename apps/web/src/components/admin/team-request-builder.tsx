/**
 * GC-Stats - team-request-builder
 *
 * Prepares an information request for one team: green/red checklist of what
 * we hold, generated message, contact choice, then records the request.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, CheckCircle2, Copy, ExternalLink, Loader2, TriangleAlert, X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AdminEntityLogo } from "@/components/admin/admin-entity-logo";
import { createTeamRequest, loadTeamRequestContext, type TeamRequestField } from "@/actions/admin-team-requests";
import { buildTeamRequestMessage, groupRoster, type RosterGroups } from "@/lib/team-requests/message";
import { contactHref } from "@/lib/team-requests/contact";
import { TEAM_REQUEST_SOCIAL_KEYS, type TeamRequestContactChannel, type TeamRequestContactKind, type TeamRequestItem } from "@/lib/team-requests/constants";
import type { ContactSuggestion, RequestRosterLine, TeamRequestContext } from "@/lib/admin-team-requests";

const CUSTOM_FREE = "custom:free";
const CUSTOM_EMAIL = "custom:email";
const suggestionKey = (c: ContactSuggestion) => `${c.kind}|${c.channel}:${c.value}`;

type SelectedContact = { kind: TeamRequestContactKind; channel: TeamRequestContactChannel; value: string; label: string };

/** Green means nothing to do, red means we have to ask for it. */
function StatusToggle({ red, onToggle, label }: { red: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={red}
      aria-label={label}
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md border transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-90",
        red ? "border-destructive/40 bg-destructive/15 text-destructive hover:bg-destructive/25" : "border-emerald-500/40 bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25"
      )}
    >
      {red ? <X className="size-4" /> : <Check className="size-4" />}
    </button>
  );
}

function OpenContactLink({ channel, value, label }: { channel: TeamRequestContactChannel; value: string; label: string }) {
  const href = contactHref(channel, value);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="flex size-8 shrink-0 items-center justify-center rounded-md border transition-all outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-90"
    >
      <ExternalLink className="size-4" />
    </a>
  );
}

function Chips({ names }: { names: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {names.map((name, index) => (
        <li key={`${name}-${index}`} className="rounded-md border bg-muted/40 px-2 py-0.5 text-sm">
          {name}
        </li>
      ))}
    </ul>
  );
}

function RosterGroupsView({ groups, labels }: { groups: RosterGroups; labels: Record<keyof RosterGroups, string> }) {
  return (
    <div className="flex flex-col gap-1.5">
      {(Object.keys(groups) as (keyof RosterGroups)[]).map(
        (group) =>
          groups[group].length > 0 && (
            <div key={group} className="flex flex-wrap items-start gap-2">
              <span className="w-16 shrink-0 pt-0.5 text-xs font-medium text-muted-foreground">{labels[group]}</span>
              <Chips names={groups[group]} />
            </div>
          )
      )}
    </div>
  );
}

export function TeamRequestBuilder({ teamId, onDone }: { teamId: number; onDone: () => void }) {
  const t = useTranslations("admin.teamRequests.builder");
  const tSocial = useTranslations("admin.teamRequests.socials");
  const tError = useTranslations("admin.teamRequests.error");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [context, setContext] = useState<TeamRequestContext | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [red, setRed] = useState<Set<TeamRequestItem>>(new Set());
  const [message, setMessage] = useState("");
  const [contactKey, setContactKey] = useState<string | null>(null);
  const [customFree, setCustomFree] = useState("");
  const [customEmail, setCustomEmail] = useState("");
  const [errors, setErrors] = useState<Partial<Record<TeamRequestField, string>>>({});
  const [copied, setCopied] = useState(false);

  function generate(ctx: TeamRequestContext, items: Set<TeamRequestItem>) {
    return buildTeamRequestMessage({ teamName: ctx.teamName, items, roster: ctx.currentRoster, unlistedPlayers: ctx.unlistedPlayers, signature: ctx.signature });
  }

  useEffect(() => {
    let cancelled = false;
    loadTeamRequestContext(teamId)
      .then((ctx) => {
        if (cancelled) return;
        if (!ctx) {
          setLoadFailed(true);
          return;
        }
        const initial = new Set<TeamRequestItem>(["roster"]);
        if (!ctx.logoUrl) initial.add("logo");
        for (const key of TEAM_REQUEST_SOCIAL_KEYS) if (!ctx.socials[key]) initial.add(key);
        setContext(ctx);
        setRed(initial);
        setMessage(generate(ctx, initial));

        const last = ctx.lastContact;
        const remembered = last && ctx.contacts.find((c) => c.kind === last.kind && c.channel === last.channel && c.value === last.value);
        if (remembered) setContactKey(suggestionKey(remembered));
        else if (last?.channel === "email") {
          setCustomEmail(last.value);
          setContactKey(CUSTOM_EMAIL);
        } else if (last?.channel === "other") {
          setCustomFree(last.value);
          setContactKey(CUSTOM_FREE);
        }
      })
      .catch(() => !cancelled && setLoadFailed(true));
    return () => {
      cancelled = true;
    };
    // The context is loaded once per team.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  function toggle(item: TeamRequestItem) {
    if (!context) return;
    const next = new Set(red);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    setRed(next);
    setMessage(generate(context, next));
    setErrors((e) => ({ ...e, items: undefined, message: undefined }));
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  function selectContact(key: string) {
    setContactKey(key);
    setErrors((e) => ({ ...e, contact: undefined }));
  }

  const selectedContact: SelectedContact | null = (() => {
    if (contactKey === CUSTOM_FREE) return { kind: "other", channel: "other", value: customFree.trim(), label: customFree.trim() };
    if (contactKey === CUSTOM_EMAIL) return { kind: "other", channel: "email", value: customEmail.trim(), label: customEmail.trim() };
    return context?.contacts.find((c) => suggestionKey(c) === contactKey) ?? null;
  })();

  function submit() {
    if (!context) return;
    startTransition(async () => {
      const result = await createTeamRequest({
        teamId: context.teamId,
        items: [...red],
        message,
        contactKind: selectedContact?.kind ?? "",
        contactChannel: selectedContact?.channel ?? "",
        contactValue: selectedContact?.value ?? "",
        contactLabel: selectedContact?.label ?? "",
      });
      if (!result.ok) {
        if (result.field) setErrors({ [result.field]: tError(result.error) });
        else toast.error(tError(result.error));
        return;
      }
      toast.success(t("created"));
      router.refresh();
      onDone();
    });
  }

  if (loadFailed) return <p className="rounded-xl border p-8 text-center text-sm text-destructive">{tError("teamNotFound")}</p>;
  if (!context) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {t("loading")}
      </div>
    );
  }

  const rosterLabels = { players: t("rosterPlayers"), subs: t("rosterSubs"), staff: t("rosterStaff") };
  const currentGroups = groupRoster(context.currentRoster);
  const pastGroups = groupRoster(context.pastRoster as RequestRosterLine[]);
  const hasPast = pastGroups.players.length + pastGroups.subs.length + pastGroups.staff.length > 0;
  const hasCurrent = context.currentRoster.length > 0;

  return (
    <div className="flex flex-col gap-6 rounded-xl border bg-card p-5">
      <header className="flex items-center gap-3">
        <AdminEntityLogo src={context.logoUrl} alt={context.teamName} sizeClassName="size-10" />
        <div>
          <h2 className="text-lg font-semibold">{t("title", { team: context.teamName })}</h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
      </header>

      {context.pendingRequestId !== null && (
        <p className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-500">
          <TriangleAlert className="size-4 shrink-0" />
          {t("alreadyPending")}
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{t("dataTitle")}</h3>
        <p className="text-xs text-muted-foreground">{t("dataHint")}</p>
        <div className="divide-y rounded-lg border">
          <div className="flex items-center gap-3 px-3 py-2">
            <StatusToggle red={red.has("logo")} onToggle={() => toggle("logo")} label={t("toggle", { item: t("logo") })} />
            <span className="w-28 shrink-0 text-sm font-medium">{t("logo")}</span>
            <AdminEntityLogo src={context.logoUrl} alt={context.teamName} sizeClassName="size-8" />
            {!context.logoUrl && <span className="text-sm text-muted-foreground">{t("missing")}</span>}
          </div>
          {TEAM_REQUEST_SOCIAL_KEYS.map((key) => (
            <div key={key} className="flex items-center gap-3 px-3 py-2">
              <StatusToggle red={red.has(key)} onToggle={() => toggle(key)} label={t("toggle", { item: tSocial(key) })} />
              <span className="w-28 shrink-0 text-sm font-medium">{tSocial(key)}</span>
              <span className={cn("min-w-0 flex-1 truncate text-sm", !context.socials[key] && "text-muted-foreground")}>{context.socials[key] ?? t("missing")}</span>
              {context.socials[key] && <OpenContactLink channel={key === "twitter" || key === "discord" ? key : "website"} value={context.socials[key]!} label={t("open")} />}
            </div>
          ))}
          <div className="flex flex-col gap-3 px-3 py-2">
            <div className="flex items-center gap-3">
              <StatusToggle red={red.has("roster")} onToggle={() => toggle("roster")} label={t("toggle", { item: t("roster") })} />
              <span className="w-28 shrink-0 text-sm font-medium">{t("roster")}</span>
              <span className="text-sm text-muted-foreground">{t("rosterCount", { current: context.currentRoster.length, past: context.pastRoster.length })}</span>
            </div>
            <div className="flex flex-col gap-3 pl-10">
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-medium text-muted-foreground">{t("rosterCurrent")}</p>
                {hasCurrent ? <RosterGroupsView groups={currentGroups} labels={rosterLabels} /> : <p className="text-sm text-muted-foreground">{t("none")}</p>}
              </div>
              {hasPast && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-muted-foreground">{t("rosterPast")}</p>
                  <RosterGroupsView groups={pastGroups} labels={rosterLabels} />
                </div>
              )}
              {context.unlistedPlayers.length > 0 && (
                <div className="flex flex-col gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-2">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-amber-500">
                    <TriangleAlert className="size-3.5" />
                    {t("unlistedTitle")}
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {context.unlistedPlayers.map((p) => (
                      <li key={p.personId} className="rounded-md border border-amber-500/30 px-2 py-0.5 text-sm">
                        {p.handle} <span className="text-muted-foreground">({t("unlistedMatches", { count: p.matches })})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
        {errors.items && <p className="text-sm text-destructive">{errors.items}</p>}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{t("messageTitle")}</h3>
          <Button type="button" variant="outline" size="sm" onClick={copy} className="active:scale-95">
            {copied ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
            {copied ? t("copied") : t("copy")}
          </Button>
        </div>
        <Textarea
          rows={14}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            setErrors((er) => ({ ...er, message: undefined }));
          }}
          aria-invalid={Boolean(errors.message)}
        />
        <p className="text-xs text-muted-foreground">{t("messageHint")}</p>
        {errors.message && <p className="text-sm text-destructive">{errors.message}</p>}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">
          {t("contactTitle")} <span className="text-destructive">*</span>
        </h3>
        {context.contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noContact")}</p>
        ) : (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("contactTitle")}>
            {context.contacts.map((c) => {
              const key = suggestionKey(c);
              const selected = contactKey === key;
              return (
                <div key={key} className={cn("flex max-w-full items-center gap-1 rounded-lg border p-1 transition-colors", selected ? "border-primary bg-primary/10" : "")}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => selectContact(key)}
                    className="flex min-w-0 flex-col items-start rounded-md px-2 py-0.5 text-left text-sm transition-all outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
                  >
                    <span className="text-xs text-muted-foreground">
                      {t(`kind.${c.kind}`)} · {tSocial(c.channel)} · {c.label}
                    </span>
                    <span className="max-w-full truncate">{c.value}</span>
                  </button>
                  <OpenContactLink channel={c.channel} value={c.value} label={t("open")} />
                </div>
              );
            })}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              { key: CUSTOM_FREE, label: t("customFree"), placeholder: t("customFreePlaceholder"), value: customFree, set: setCustomFree, channel: "other" },
              { key: CUSTOM_EMAIL, label: t("customEmail"), placeholder: t("customEmailPlaceholder"), value: customEmail, set: setCustomEmail, channel: "email" },
            ] as const
          ).map((field) => (
            <div key={field.key} className={cn("flex flex-col gap-1.5 rounded-lg border p-2 transition-colors", contactKey === field.key ? "border-primary bg-primary/10" : "")}>
              <label htmlFor={field.key} className="text-xs font-medium text-muted-foreground">
                {field.label}
              </label>
              <div className="flex items-center gap-1">
                <Input
                  id={field.key}
                  type={field.channel === "email" ? "email" : "text"}
                  maxLength={300}
                  placeholder={field.placeholder}
                  value={field.value}
                  onFocus={() => selectContact(field.key)}
                  onChange={(e) => {
                    field.set(e.target.value);
                    selectContact(field.key);
                  }}
                />
                <OpenContactLink channel={field.channel} value={field.value} label={t("open")} />
              </div>
            </div>
          ))}
        </div>
        {errors.contact && <p className="text-sm text-destructive">{errors.contact}</p>}
        {errors.team && <p className="text-sm text-destructive">{errors.team}</p>}
      </section>

      <footer className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={isPending} className="active:scale-95">
          {t("cancel")}
        </Button>
        <Button type="button" onClick={submit} disabled={isPending} className="active:scale-95">
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {t("validate")}
        </Button>
      </footer>
    </div>
  );
}

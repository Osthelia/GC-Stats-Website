/**
 * GC-Stats - membership-history-section
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CountryBadge } from "@/components/team/country-badge";
import { PublicSelect } from "@/components/forms/public-select";
import { PublicEntityPicker } from "@/components/forms/public-entity-picker";
import { ROSTER_ROLES, MAX_MEMBERSHIP_ADDITIONS, type MembershipOperation } from "@/lib/change-request-fields";
import { rosterRoleStyles } from "@/lib/roster-roles";

const inputClass =
  "rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-2.5 py-1.5 text-[12.5px] text-neutral-50 outline-none transition-colors focus:border-[#e4ae22]/60";

export type MembershipEntryView = {
  membershipId: number;
  displayName: string;
  countryCode: string | null;
  secondaryCountryCode: string | null;
  role: string;
  since: string | null;
  until: string | null;
  inactiveSince: string | null;
  isCurrent: boolean;
};

type EditState = { role: string; since: string; until: string; inactiveSince: string; deleted: boolean };
type AddDraft = { entity: { id: number; label: string } | null; role: string; since: string; until: string; inactiveSince: string };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Same roster-editing surface as admin (components/admin/{team-roster,player-team-history}-panel.tsx),
 * ported to the "suggest an edit" flow — everything here stages a proposal
 * (diffed against the original at submit time) instead of writing directly,
 * since a public visitor can't hold teams.edit/players.edit. `mode` controls
 * which side of roster_memberships is fixed (the subject) and which is
 * picked via PublicEntityPicker.
 */
export function MembershipHistorySection({
  mode,
  fixedId,
  entries,
  onChange,
}: {
  mode: "team" | "person";
  /** The team id (mode="team") or person id (mode="person") this suggest-edit page is for — the fixed side of every roster_memberships row. */
  fixedId: number;
  entries: MembershipEntryView[];
  onChange: (ops: MembershipOperation[]) => void;
}) {
  const t = useTranslations("suggestEdit.membership");
  const tRole = useTranslations("suggestEdit.roster.roleOption");

  const [edits, setEdits] = useState<Record<number, EditState>>(() =>
    Object.fromEntries(
      entries.map((e) => [e.membershipId, { role: e.role, since: e.since ?? today(), until: e.until ?? "", inactiveSince: e.inactiveSince ?? "", deleted: false }])
    )
  );
  const [additions, setAdditions] = useState<AddDraft[]>([]);

  const roleOptions = ROSTER_ROLES.map((r) => ({ value: r, label: tRole(r.replace(/\s+/g, "_")) }));

  function emit(nextEdits: Record<number, EditState>, nextAdditions: AddDraft[]) {
    const ops: MembershipOperation[] = [];
    for (const entry of entries) {
      const edit = nextEdits[entry.membershipId];
      if (!edit) continue;
      if (edit.deleted) {
        ops.push({ type: "delete", membershipId: entry.membershipId });
        continue;
      }
      const changed =
        edit.role !== entry.role ||
        edit.since !== (entry.since ?? today()) ||
        (edit.until || null) !== entry.until ||
        (edit.inactiveSince || null) !== entry.inactiveSince;
      if (changed) {
        ops.push({
          type: "edit",
          membershipId: entry.membershipId,
          role: edit.role,
          since: edit.since,
          until: edit.until || null,
          inactiveSince: edit.inactiveSince || null,
        });
      }
    }
    for (const draft of nextAdditions) {
      if (!draft.entity) continue;
      ops.push({
        type: "add",
        personId: mode === "team" ? draft.entity.id : fixedId,
        teamId: mode === "person" ? draft.entity.id : fixedId,
        role: draft.role,
        since: draft.since,
        until: draft.until || null,
        inactiveSince: draft.inactiveSince || null,
      });
    }
    onChange(ops);
  }

  function updateEdit(membershipId: number, patch: Partial<EditState>) {
    const next = { ...edits, [membershipId]: { ...edits[membershipId]!, ...patch } };
    setEdits(next);
    emit(next, additions);
  }

  function addRow() {
    if (additions.length >= MAX_MEMBERSHIP_ADDITIONS) return;
    const next = [...additions, { entity: null, role: "player", since: today(), until: "", inactiveSince: "" }];
    setAdditions(next);
  }

  function updateAddition(index: number, patch: Partial<AddDraft>) {
    const next = additions.map((a, i) => (i === index ? { ...a, ...patch } : a));
    setAdditions(next);
    emit(edits, next);
  }

  function removeAddition(index: number) {
    const next = additions.filter((_, i) => i !== index);
    setAdditions(next);
    emit(edits, next);
  }

  const current = entries.filter((e) => e.isCurrent);
  const past = entries.filter((e) => !e.isCurrent);

  function renderCard(entry: MembershipEntryView) {
    const edit = edits[entry.membershipId]!;
    const styles = rosterRoleStyles(edit.role, !!edit.inactiveSince);
    const initial = entry.displayName.trim().charAt(0).toUpperCase() || "?";

    return (
      <div key={entry.membershipId} className={`flex flex-col overflow-hidden rounded-lg border border-neutral-800 ${edit.deleted ? "opacity-40" : ""}`}>
        <div className={`h-1 w-full shrink-0 ${styles.bar}`} />
        <div className="flex flex-1 flex-col gap-2.5 p-3">
          <div className="flex items-center gap-2.5">
            <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-black ${styles.badgeBg} ${styles.badgeText}`}>{initial}</div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex min-w-0 items-center gap-1.5 truncate text-[13.5px] font-semibold text-neutral-100">
                <CountryBadge code={entry.countryCode} secondaryCode={entry.secondaryCountryCode} />
                <span className="truncate">{entry.displayName}</span>
              </div>
              {!entry.isCurrent && <span className="text-[10.5px] text-neutral-500">{t("past")}</span>}
            </div>
          </div>

          {!edit.deleted && (
            <div className="flex flex-col gap-2">
              <PublicSelect value={edit.role} onChange={(v) => updateEdit(entry.membershipId, { role: v })} options={roleOptions} />
              <div className="grid grid-cols-2 gap-1.5">
                <input type="date" value={edit.since} onChange={(e) => updateEdit(entry.membershipId, { since: e.target.value })} className={inputClass} />
                <input type="date" value={edit.until} onChange={(e) => updateEdit(entry.membershipId, { until: e.target.value })} className={inputClass} />
              </div>
              <input
                type="date"
                value={edit.inactiveSince}
                onChange={(e) => updateEdit(entry.membershipId, { inactiveSince: e.target.value })}
                placeholder={t("inactiveSince")}
                className={inputClass}
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => updateEdit(entry.membershipId, { deleted: !edit.deleted })}
            className="self-start text-[12px] text-[#e08585] underline hover:text-[#f0a0a0]"
          >
            {edit.deleted ? t("undoRemove") : t("remove")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-neutral-800 bg-[var(--gcs-surface)] p-6">
      <h2 className="text-[15px] font-semibold text-neutral-50">{mode === "team" ? t("titleRoster") : t("titleTeamHistory")}</h2>

      {entries.length === 0 && <p className="text-[13.5px] text-neutral-500">{t("empty")}</p>}

      {current.length > 0 && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{current.map(renderCard)}</div>}

      {past.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{t("pastTitle")}</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{past.map(renderCard)}</div>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-neutral-800 pt-4">
        <span className="text-[13px] font-medium text-neutral-300">{mode === "team" ? t("addPersonTitle") : t("addTeamTitle")}</span>
        {additions.map((draft, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <PublicEntityPicker
              type={mode === "team" ? "player" : "team"}
              value={draft.entity}
              onChange={(v) => updateAddition(i, { entity: v })}
              placeholder={mode === "team" ? t("pickPlayerPlaceholder") : t("pickTeamPlaceholder")}
              searchPlaceholder={t("searchPlaceholder")}
              noResultsLabel={t("noResults")}
            />
            <PublicSelect value={draft.role} onChange={(v) => updateAddition(i, { role: v })} options={roleOptions} />
            <input type="date" value={draft.since} onChange={(e) => updateAddition(i, { since: e.target.value })} className={inputClass} />
            <button type="button" onClick={() => removeAddition(i)} className="text-[12px] text-[#e08585] underline hover:text-[#f0a0a0]">
              {t("remove")}
            </button>
          </div>
        ))}
        {additions.length < MAX_MEMBERSHIP_ADDITIONS && (
          <button
            type="button"
            onClick={addRow}
            className="self-start rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-3.5 py-1.5 text-[12.5px] font-semibold text-neutral-300 transition-colors hover:border-[#e4ae22]/60"
          >
            {t("addRow")}
          </button>
        )}
      </div>

      <p className="text-[12px] leading-relaxed text-neutral-500">{t("hint")}</p>
    </div>
  );
}

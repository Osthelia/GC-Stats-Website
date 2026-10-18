/**
 * GC-Stats - tournament-liquipedia-people-panel
 *
 * Completes the Liquipedia names of a tournament's players and staff: paste
 * the participants wikicode, review the suggested matches (click a row to
 * toggle it), save the checked ones.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckIcon } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LiquipediaMappingTable, type RowState } from "@/components/admin/liquipedia-mapping-table";
import { saveLiquipediaPersonNames, searchLiquipediaPeople, type LiquipediaPersonRowError } from "@/actions/admin-liquipedia";
import { PersonPicker } from "@/components/admin/person-picker";
import { parsePersonEntries, suggestPersonMatches, type PersonEntry } from "@/lib/liquipedia-person-match";
import { validateLiquipediaName } from "@/lib/liquipedia-name-validation";
import type { LiquipediaTournamentPerson } from "@/lib/admin-liquipedia";
import { cn } from "@/lib/utils";
import { useGame } from "@/lib/use-game";

function initialRows(people: LiquipediaTournamentPerson[]): Record<number, RowState> {
  return Object.fromEntries(
    people.map((person) => [
      person.personId,
      person.liquipediaName
        ? { name: person.liquipediaName, checked: false, confidence: "linked", score: null }
        : { name: "", checked: false, confidence: "none", score: null },
    ])
  );
}

export function TournamentLiquipediaPeoplePanel({ tournamentId, people, canManage }: { tournamentId: number; people: LiquipediaTournamentPerson[]; canManage: boolean }) {
  const game = useGame();
  const t = useTranslations("admin.tournaments.liquipedia");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [wikicode, setWikicode] = useState("");
  const [parsedEntries, setParsedEntries] = useState<PersonEntry[] | null>(null);
  // People picked for names that match nobody of the tournament (staff mostly), shown as extra table rows.
  const [extraPeople, setExtraPeople] = useState<{ personId: number; handle: string }[]>([]);
  const [showLinked, setShowLinked] = useState(false);
  const [rows, setRows] = useState<Record<number, RowState>>(() => initialRows(people));
  const [rowErrors, setRowErrors] = useState<Record<number, LiquipediaPersonRowError>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const missingCount = people.filter((person) => rows[person.personId]?.confidence !== "linked").length;
  const visiblePeople = useMemo(() => people.filter((person) => showLinked || rows[person.personId]?.confidence !== "linked"), [people, rows, showLinked]);
  const checkedCount = Object.values(rows).filter((r) => r.checked).length;

  // Names already held by a person of this tournament aren't offered again.
  const availableNames = useMemo(() => {
    const taken = new Set(Object.values(rows).filter((r) => r.confidence === "linked").map((r) => r.name.toLowerCase()));
    return (parsedEntries ?? []).map((entry) => entry.name).filter((name) => !taken.has(name.toLowerCase()));
  }, [parsedEntries, rows]);

  // Names of the pasted wikicode no row holds yet.
  const unmatchedEntries = useMemo(() => {
    const used = new Set(Object.values(rows).map((r) => r.name.trim().toLowerCase()));
    return (parsedEntries ?? []).filter((entry) => !used.has(entry.name.toLowerCase())).sort((a, b) => Number(b.isStaff) - Number(a.isStaff));
  }, [parsedEntries, rows]);

  function pickPerson(entry: PersonEntry, person: { id: number; handle: string } | null) {
    if (!person) return;
    setRowErrors(({ [person.id]: _removed, ...rest }) => rest);
    if (!people.some((p) => p.personId === person.id)) {
      setExtraPeople((current) => (current.some((p) => p.personId === person.id) ? current : [...current, { personId: person.id, handle: person.handle }]));
    }
    setRows((current) => ({ ...current, [person.id]: { name: entry.name, checked: true, confidence: "manual", score: null } }));
  }

  function handleAnalyze() {
    const entries = parsePersonEntries(wikicode);
    const names = entries.map((entry) => entry.name);
    setParsedEntries(entries);
    setRowErrors({});
    setFormError(null);
    // Linked and hand-edited rows are kept as they are, their names aren't suggested again.
    const takenNames = new Set(Object.values(rows).filter((r) => r.confidence === "linked" || r.confidence === "manual").map((r) => r.name.toLowerCase()));
    const candidates = people.filter((person) => rows[person.personId]?.confidence !== "linked" && rows[person.personId]?.confidence !== "manual").map((person) => ({ personId: person.personId, names: person.names }));
    const suggestions = suggestPersonMatches(
      candidates,
      names.filter((name) => !takenNames.has(name.toLowerCase()))
    );
    setRows((current) => {
      const next = { ...current };
      for (const candidate of candidates) next[candidate.personId] = { name: "", checked: false, confidence: "none", score: null };
      for (const s of suggestions) {
        next[s.personId] = { name: s.liquipediaName, checked: s.confidence !== "possible", confidence: s.confidence, score: s.score };
      }
      return next;
    });
  }

  function toggleRow(personId: number) {
    if (!canManage) return;
    setRows((current) => ({ ...current, [personId]: { ...current[personId]!, checked: !current[personId]!.checked } }));
  }

  function editName(personId: number, name: string) {
    setRowErrors(({ [personId]: _removed, ...rest }) => rest);
    setRows((current) => {
      const row = current[personId]!;
      const wasLinkedUnchanged = row.confidence === "linked" && people.find((person) => person.personId === personId)?.liquipediaName === name;
      return { ...current, [personId]: { name, checked: name.trim() !== "" && !wasLinkedUnchanged, confidence: row.confidence === "linked" ? "linked" : "manual", score: null } };
    });
  }

  function handleSave() {
    setFormError(null);
    const payload = Object.entries(rows)
      .filter(([, row]) => row.checked)
      .map(([personId, row]) => ({ personId: Number(personId), name: row.name.trim() }));

    // Same checks as the server, so obvious mistakes show without a round trip.
    const localErrors: Record<number, LiquipediaPersonRowError> = {};
    for (const row of payload) {
      const error = validateLiquipediaName(row.name);
      if (error) localErrors[row.personId] = { error };
    }
    if (Object.keys(localErrors).length > 0) {
      setRowErrors(localErrors);
      return;
    }

    startTransition(async () => {
      const result = await saveLiquipediaPersonNames(game, tournamentId, payload);
      if (!result.ok) {
        setRowErrors(result.rowErrors);
        if (result.error) setFormError(t(`error.${result.error}`));
        else toast.error(t("error.rows"));
        return;
      }
      setRows((current) => {
        const next = { ...current };
        for (const row of payload) next[row.personId] = { name: row.name, checked: false, confidence: "linked", score: null };
        return next;
      });
      toast.success(t("people.saveSuccess", { count: result.saved }));
      router.refresh();
    });
  }

  if (people.length === 0) return <p className="text-sm text-muted-foreground">{t("people.noPeople")}</p>;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-base">{t("wikicodeTitle")}</CardTitle>
          <CardDescription>{t("people.wikicodeDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Textarea
            rows={10}
            value={wikicode}
            onChange={(e) => setWikicode(e.target.value)}
            placeholder={t("people.wikicodePlaceholder")}
            className="font-mono text-xs"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={handleAnalyze} disabled={wikicode.trim() === ""}>
              {t("analyzeButton")}
            </Button>
            {parsedEntries !== null && (
              <span className={cn("text-xs", parsedEntries.length === 0 ? "text-destructive" : "text-muted-foreground")}>
                {parsedEntries.length === 0 ? t("people.noNamesFound") : t("parsedCount", { count: parsedEntries.length })}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">{t("people.tableTitle", { missing: missingCount, total: people.length })}</CardTitle>
          <CardDescription>{t("toggleHint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setShowLinked((v) => !v)}
            className="flex w-fit items-center gap-2 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground active:opacity-60"
          >
            <span className={cn("flex size-4 items-center justify-center rounded border", showLinked ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
              {showLinked && <CheckIcon className="size-3" />}
            </span>
            {t("people.showLinked")}
          </button>

          {missingCount === 0 && !showLinked ? (
            <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400">{t("people.allLinked")}</p>
          ) : (
            <LiquipediaMappingTable
              items={[
                ...visiblePeople.map((person) => ({ id: person.personId, label: person.handle, badge: t(`people.kind.${person.kind}`), sublabel: person.teamName, currentName: person.liquipediaName })),
                ...extraPeople.map((person) => ({ id: person.personId, label: person.handle, currentName: null })),
              ]}
              rows={rows}
              rowErrors={rowErrors}
              suggestions={availableNames}
              canManage={canManage}
              labelColumn={t("people.columnPerson")}
              errorText={(error) => (error.error === "nameTaken" ? t(`people.error.${error.error}`, { owner: error.teamName ?? "" }) : t(`error.${error.error}`))}
              onToggle={toggleRow}
              onEditName={editName}
            />
          )}


          {unmatchedEntries.length > 0 && (
            <div className="flex flex-col gap-2 rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">{t("people.unmatched.title", { count: unmatchedEntries.length })}</p>
                <p className="text-xs text-muted-foreground">{t("people.unmatched.description")}</p>
              </div>
              {unmatchedEntries.map((entry) => (
                <div key={entry.name} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-2">
                  <div className="flex min-w-0 items-center gap-2 text-sm">
                    <span className="truncate font-medium">{entry.name}</span>
                    {entry.isStaff && <Badge className="bg-muted text-[10px] text-muted-foreground uppercase">{t("people.kind.staff")}</Badge>}
                    {entry.team && <span className="truncate text-xs text-muted-foreground">{entry.team}</span>}
                  </div>
                  <PersonPicker
                    value={null}
                    onChange={(person) => pickPerson(entry, person)}
                    placeholder={t("people.unmatched.pick")}
                    searchPlaceholder={t("people.unmatched.search")}
                    noResultsLabel={t("people.unmatched.noResults")}
                    search={(query) => searchLiquipediaPeople(game, query, entry.team)}
                  />
                </div>
              ))}
            </div>
          )}

          {formError && (
            <p role="alert" className="text-xs text-destructive">
              {formError}
            </p>
          )}
          {canManage && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">{t("checkedCount", { count: checkedCount })}</span>
              <Button onClick={handleSave} disabled={isPending || checkedCount === 0}>
                {isPending ? t("saving") : t("saveButton")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

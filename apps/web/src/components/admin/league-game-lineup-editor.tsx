/**
 * GC-Stats - league-game-lineup-editor
 *
 * The lineup of one League game entered by hand, for games without Riot or Leaguepedia data: per team one row per
 * lane with the player, the champion and the build (summoner spells, keystone, secondary tree, items and trinket), all
 * optional, and optionally the scoreboard. A scoreboard is all or nothing (every player of both teams and the game
 * length); only gold, damage and vision can be left empty in it. Nothing is stored until Save, which replaces the
 * lineup. The rules run here before saving and again on the server; a problem marks its field and says what is wrong.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronDownIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SearchablePicker, type SearchablePickerOption } from "@/components/admin/searchable-picker";
import { PersonPicker } from "@/components/admin/person-picker";
import { laneIconUrl } from "@/components/match/lol-icon";
import { saveLeagueGameLineup, type LeagueLineupError } from "@/actions/admin-lol-games";
import type { LeagueLineupView } from "@/lib/admin-matches";
import { buildCatalogOf, type BuildOption, type LeagueBuildOptions } from "@/lib/league-build-options";
import {
  LINEUP_ITEM_SLOTS,
  LINEUP_OPTIONAL_STATS,
  LINEUP_STAT_KEYS,
  LINEUP_SUMMONER_SLOTS,
  LINEUP_TRINKET_SLOT,
  buildHasParts,
  lineupProblem,
  type LineupBuild,
  type LineupField,
  type LineupInput,
  type LineupPlayerInput,
  type LineupProblem,
  type LineupStatKey,
} from "@/lib/league-lineup-rules";
import { formatGameDuration } from "@/lib/league-scoreboard";
import { parseGameLength } from "@/lib/liquipedia-lol-match-wikicode";
import { cn } from "@/lib/utils";
import { LEAGUE_ROLES, type LeagueRole } from "@gc-stats/lol-stats-engine/lanes";
import { useGame } from "@/lib/use-game";

type RowPerson = { id: number; handle: string } | { newHandle: string };
type RowState = { person: RowPerson | null; championName: string | null; stats: Record<LineupStatKey, string>; build: LineupBuild; buildOpen: boolean };

/** A problem shown on the page: on a field of a row, on the game length, or (without a place) above the teams. */
type ShownProblem = { message: string; rowKey: string | null; field: LineupField | "duration" | null };

const EMPTY_STATS: Record<LineupStatKey, string> = { kills: "", deaths: "", assists: "", cs: "", gold: "", damage: "", vision: "" };
const emptyBuild = (): LineupBuild => ({ summoners: Array(LINEUP_SUMMONER_SLOTS).fill(null), keystone: null, secondaryTree: null, items: Array(LINEUP_ITEM_SLOTS).fill(null) });
const emptyRow = (): RowState => ({ person: null, championName: null, stats: { ...EMPTY_STATS }, build: emptyBuild(), buildOpen: false });
const rowKey = (entrantId: number, lane: LeagueRole) => `${entrantId}:${lane}`;
/** The id of a field's control, so a problem can focus it. */
const fieldId = (key: string, field: LineupField) => `lineup-${key}-${field}`;
const DURATION_ID = "lineup-duration";
const BUILD_FIELDS = (field: LineupField) => field.startsWith("summoner.") || field.startsWith("item.") || field === "keystone" || field === "secondaryTree";

function initialRows(lineup: LeagueLineupView): Record<string, RowState> {
  const rows: Record<string, RowState> = {};
  for (const player of lineup.players) {
    if (!(LEAGUE_ROLES as readonly (string | null)[]).includes(player.role)) continue;
    const stats = player.stats;
    rows[rowKey(player.entrantId, player.role as LeagueRole)] = {
      person: { id: player.personId, handle: player.handle },
      championName: player.championName,
      stats: stats ? (Object.fromEntries(LINEUP_STAT_KEYS.map((key) => [key, stats[key] === null ? "" : String(stats[key])])) as Record<LineupStatKey, string>) : { ...EMPTY_STATS },
      build: player.build ?? emptyBuild(),
      buildOpen: player.build !== null,
    };
  }
  return rows;
}

/** A typed number: null when empty, NaN when it is not a number (the rules refuse it). */
const statValue = (text: string): number | null => (text.trim() === "" ? null : Number(text.trim()));

export function LeagueGameLineupEditor({
  tournamentId,
  matchId,
  entrants,
  lineup,
  champions,
  buildOptions,
  canManage,
}: {
  tournamentId: number;
  matchId: number;
  entrants: { id: number; name: string }[];
  lineup: LeagueLineupView;
  champions: string[];
  /** The summoner spells, runes and items of the match's patch; null when Data Dragon can't be reached. */
  buildOptions: LeagueBuildOptions | null;
  canManage: boolean;
}) {
  const game = useGame();
  const t = useTranslations("admin.tournaments.matches.lineup");
  const tLane = useTranslations("lanes");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<Record<string, RowState>>(() => initialRows(lineup));
  const [withStats, setWithStats] = useState(lineup.hasStats);
  const [duration, setDuration] = useState(lineup.durationSeconds ? formatGameDuration(lineup.durationSeconds) : "");
  const [newPlayerRows, setNewPlayerRows] = useState<Set<string>>(new Set());
  const [problem, setProblem] = useState<ShownProblem | null>(null);

  // A new problem brings its field into view and gives it the focus.
  useEffect(() => {
    if (!problem?.field) return;
    const element = document.getElementById(problem.field === "duration" ? DURATION_ID : fieldId(problem.rowKey!, problem.field));
    element?.scrollIntoView({ block: "center", behavior: "smooth" });
    element?.focus({ preventScroll: true });
  }, [problem]);

  const rowOf = (key: string): RowState => rows[key] ?? emptyRow();
  // Editing a row takes back the problem shown on it: it may be fixed now, and Save checks again.
  const setRow = (key: string, patch: Partial<RowState>) => {
    setRows((prev) => ({ ...prev, [key]: { ...(prev[key] ?? emptyRow()), ...patch } }));
    if (problem?.rowKey === key) setProblem(null);
  };
  const setBuild = (key: string, patch: Partial<LineupBuild>) => setRow(key, { build: { ...rowOf(key).build, ...patch } });

  const usedPersonIds = new Set(Object.values(rows).flatMap((row) => (row.person && "id" in row.person ? [row.person.id] : [])));
  const usedChampions = new Set(Object.values(rows).flatMap((row) => (row.championName ? [row.championName] : [])));

  function lineupInput(): LineupInput {
    const players: LineupPlayerInput[] = [];
    for (const entrant of entrants) {
      for (const lane of LEAGUE_ROLES) {
        const row = rows[rowKey(entrant.id, lane)];
        if (!row?.person) continue;
        players.push({
          entrantId: entrant.id,
          person: "id" in row.person ? { id: row.person.id } : { newHandle: row.person.newHandle },
          role: lane,
          championName: row.championName,
          stats: withStats ? (Object.fromEntries(LINEUP_STAT_KEYS.map((key) => [key, statValue(row.stats[key])])) as Record<LineupStatKey, number | null>) : null,
          build: buildHasParts(row.build) ? row.build : null,
        });
      }
    }
    return { players, durationSeconds: withStats ? parseGameLength(duration) : null };
  }

  function problemText(found: LineupProblem): string {
    if (found.kind === "duplicateLane") return t("error.problem.duplicateLane", { lane: tLane(found.role) });
    if (found.kind === "unknownChampion" || found.kind === "duplicateChampion") return t(`error.problem.${found.kind}`, { championName: found.championName });
    if (found.kind === "invalidStat") return t("error.problem.invalidStat", { max: found.max });
    return t(`error.problem.${found.kind}`);
  }

  function show(found: LineupProblem) {
    const message = problemText(found);
    const at = found.at;
    if (at) {
      const key = rowKey(at.entrantId, at.role);
      // A problem in a closed build opens it, so the marked field can be seen.
      if (BUILD_FIELDS(at.field)) setRows((prev) => ({ ...prev, [key]: { ...(prev[key] ?? emptyRow()), buildOpen: true } }));
      setProblem({ message, rowKey: key, field: at.field });
    } else {
      setProblem({ message, rowKey: null, field: found.kind === "durationRequired" ? "duration" : null });
    }
    toast.error(message);
  }

  function save() {
    const input = lineupInput();
    // The same rules as the server, so most mistakes show at once; the server checks again.
    const found = lineupProblem(input, {
      entrantIds: entrants.map((entrant) => entrant.id),
      knownChampions: new Set(champions),
      buildCatalog: buildOptions ? buildCatalogOf(buildOptions) : null,
    });
    if (found) {
      show(found);
      return;
    }
    setProblem(null);
    startTransition(async () => {
      const result = await saveLeagueGameLineup(game, tournamentId, matchId, lineup.gameId, input);
      if (!result.ok) {
        showError(result.error);
        return;
      }
      toast.success(t("saved"));
      router.push(`/admin/tournaments/${tournamentId}/matches/${matchId}`);
    });
  }

  function showError(error: LeagueLineupError) {
    if (error.kind === "lineupProblem") {
      show(error.problem);
      return;
    }
    toast.error(t(`error.${error.kind}`));
  }

  if (lineup.imported) {
    return <p className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">{t("importedHint")}</p>;
  }

  /** The problem's message when it is on this field of this row. */
  const problemAt = (key: string, field: LineupField): string | null => (problem && problem.rowKey === key && problem.field === field ? problem.message : null);

  const championOptions = (current: string | null) => champions.map((name) => ({ id: name, label: name, disabled: name !== current && usedChampions.has(name) }));
  // An id the patch doesn't list (a build saved on another patch) stays choosable, by its number.
  const optionsOf = (list: BuildOption[], current: number | null, disabled?: (option: BuildOption) => boolean): SearchablePickerOption[] => {
    const options = list.map((option) => ({ id: String(option.id), label: option.name, disabled: disabled?.(option) ?? false }));
    return current !== null && !list.some((option) => option.id === current) ? [{ id: String(current), label: `#${current}` }, ...options] : options;
  };

  function buildPicker(key: string, field: LineupField, label: string, value: number | null, options: SearchablePickerOption[], onChange: (id: number | null) => void) {
    const error = problemAt(key, field);
    return (
      <Field key={field} label={label} htmlFor={fieldId(key, field)} error={error}>
        <SearchablePicker
          id={fieldId(key, field)}
          value={value === null ? null : String(value)}
          options={options}
          onChange={(id) => onChange(id === null ? null : Number(id))}
          placeholder={t("empty")}
          noneLabel={t("empty")}
          searchPlaceholder={t("search")}
          noResultsLabel={t("noResults")}
          invalid={error !== null}
        />
      </Field>
    );
  }

  function buildSection(key: string, row: RowState) {
    if (!buildOptions) return <p className="text-xs text-muted-foreground">{t("buildUnavailable")}</p>;
    const options = buildOptions;
    const keystoneTree = options.keystones.find((option) => option.id === row.build.keystone)?.treeId ?? null;
    return (
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {row.build.summoners.map((id, slot) =>
            buildPicker(key, `summoner.${slot}`, t("summoner", { slot: slot + 1 }), id, optionsOf(options.summoners, id), (next) =>
              setBuild(key, { summoners: row.build.summoners.map((value, i) => (i === slot ? next : value)) }),
            ),
          )}
          {buildPicker(key, "keystone", t("keystone"), row.build.keystone, optionsOf(options.keystones, row.build.keystone), (next) => setBuild(key, { keystone: next }))}
          {buildPicker(
            key,
            "secondaryTree",
            t("secondaryTree"),
            row.build.secondaryTree,
            // The keystone's own tree can't be the secondary one.
            optionsOf(options.trees, row.build.secondaryTree, (option) => option.id === keystoneTree),
            (next) => setBuild(key, { secondaryTree: next }),
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {row.build.items.map((id, slot) =>
            buildPicker(
              key,
              `item.${slot}`,
              slot === LINEUP_TRINKET_SLOT ? t("trinket") : t("item", { slot: slot + 1 }),
              id,
              optionsOf(slot === LINEUP_TRINKET_SLOT ? options.trinkets : options.items, id),
              (next) => setBuild(key, { items: row.build.items.map((value, i) => (i === slot ? next : value)) }),
            ),
          )}
        </div>
      </div>
    );
  }

  const durationProblem = problem?.field === "duration" ? problem.message : null;

  return (
    <div className="flex flex-col gap-6">
      {lineup.fromPreviousGame && <p className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-300">{t("fromPreviousGame")}</p>}

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Checkbox id="lineup-with-stats" checked={withStats} disabled={!canManage} onCheckedChange={(checked) => setWithStats(checked === true)} />
          <Label htmlFor="lineup-with-stats">{t("withStats")}</Label>
        </div>
        <p className="text-xs text-muted-foreground">{t("withStatsHint")}</p>
        {withStats && (
          <div className="max-w-xs">
            <Field label={t("duration")} htmlFor={DURATION_ID} error={durationProblem}>
              <Input
                id={DURATION_ID}
                value={duration}
                placeholder="32:15"
                aria-invalid={durationProblem !== null}
                onChange={(e) => {
                  setDuration(e.target.value);
                  if (problem?.field === "duration") setProblem(null);
                }}
                disabled={!canManage}
              />
            </Field>
          </div>
        )}
      </div>

      {problem && problem.field === null && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{problem.message}</p>}

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        {entrants.map((entrant) => {
          const picks = lineup.draftPicks[entrant.id] ?? [];
          const suggestions = lineup.suggestions[entrant.id] ?? [];
          return (
            <section key={entrant.id} className="flex flex-col gap-3">
              <h2 className="text-md font-semibold">{entrant.name}</h2>
              {picks.length > 0 && <p className="text-xs text-muted-foreground">{t("draftPicks", { champions: picks.join(", ") })}</p>}
              {LEAGUE_ROLES.map((lane) => {
                const key = rowKey(entrant.id, lane);
                const row = rowOf(key);
                const creating = newPlayerRows.has(key);
                const freeSuggestions = suggestions.filter((person) => !usedPersonIds.has(person.id));
                const playerProblem = problemAt(key, "player");
                const championProblem = problemAt(key, "champion");
                return (
                  <div key={lane} className={cn("flex flex-col gap-2 rounded-lg border p-3", problem?.rowKey === key && "border-destructive/60")}>
                    <div className="flex items-center gap-2">
                      <img src={laneIconUrl(lane)} alt="" width={18} height={18} />
                      <span className="text-sm font-semibold">{tLane(lane)}</span>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Field label={t("player")} htmlFor={fieldId(key, "player")} error={playerProblem}>
                        {row.person && "newHandle" in row.person ? (
                          <div
                            id={fieldId(key, "player")}
                            tabIndex={-1}
                            className={cn("flex items-center gap-2 rounded-lg outline-none", playerProblem && "border border-destructive px-2 ring-3 ring-destructive/20")}
                          >
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">
                              {row.person.newHandle}
                              <span className="ml-1 text-xs text-muted-foreground">{t("newPlayerTag")}</span>
                            </span>
                            {canManage && (
                              <Button variant="ghost" size="icon-sm" aria-label={t("clearPlayer")} onClick={() => setRow(key, { person: null })}>
                                <XIcon className="size-4" />
                              </Button>
                            )}
                          </div>
                        ) : creating ? (
                          <Input
                            id={fieldId(key, "player")}
                            autoFocus
                            placeholder={t("newPlayerHandle")}
                            aria-invalid={playerProblem !== null}
                            onKeyDown={(e) => {
                              const handle = e.currentTarget.value.trim();
                              if (e.key === "Enter" && handle !== "") {
                                setRow(key, { person: { newHandle: handle } });
                                setNewPlayerRows((prev) => new Set([...prev].filter((k) => k !== key)));
                              }
                            }}
                            onBlur={(e) => {
                              const handle = e.currentTarget.value.trim();
                              if (handle !== "") setRow(key, { person: { newHandle: handle } });
                              setNewPlayerRows((prev) => new Set([...prev].filter((k) => k !== key)));
                            }}
                          />
                        ) : (
                          <div className="flex flex-col gap-1">
                            {!row.person && freeSuggestions.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {freeSuggestions.map((person) => (
                                  <Button key={person.id} size="xs" variant="outline" disabled={!canManage} onClick={() => setRow(key, { person: { id: person.id, handle: person.handle } })}>
                                    {person.handle}
                                  </Button>
                                ))}
                              </div>
                            )}
                            {/* The select stays in place once a player is chosen, like the champion select, so the focus stays in the row. */}
                            <div className="flex items-center gap-1">
                              {/* The wrapper carries the field's id and its red frame: a problem scrolls to it and marks it. */}
                              <div id={fieldId(key, "player")} tabIndex={-1} className={cn("min-w-0 flex-1 rounded-lg outline-none", playerProblem && "ring-3 ring-destructive/40")}>
                                <PersonPicker
                                  value={row.person}
                                  // A player already in the lineup can't play a second lane.
                                  onChange={(person) => person && !usedPersonIds.has(person.id) && setRow(key, { person: { id: person.id, handle: person.handle } })}
                                  placeholder={t("pickPlayer")}
                                  searchPlaceholder={t("searchPlayer")}
                                  noResultsLabel={t("noResults")}
                                />
                              </div>
                              {row.person && canManage && (
                                <Button variant="ghost" size="icon-sm" aria-label={t("clearPlayer")} onClick={() => setRow(key, { person: null })}>
                                  <XIcon className="size-4" />
                                </Button>
                              )}
                            </div>
                            {!row.person && canManage && (
                              <Button size="xs" variant="ghost" className="self-start" onClick={() => setNewPlayerRows((prev) => new Set([...prev, key]))}>
                                {t("newPlayer")}
                              </Button>
                            )}
                          </div>
                        )}
                      </Field>

                      <Field label={t("champion")} htmlFor={fieldId(key, "champion")} error={championProblem}>
                        <SearchablePicker
                          id={fieldId(key, "champion")}
                          value={row.championName}
                          options={championOptions(row.championName)}
                          onChange={(name) => setRow(key, { championName: name })}
                          placeholder={t("unknownChampion")}
                          noneLabel={t("unknownChampion")}
                          searchPlaceholder={t("searchChampion")}
                          noResultsLabel={t("noResults")}
                          invalid={championProblem !== null}
                        />
                        {!row.championName && picks.some((name) => !usedChampions.has(name)) && (
                          <div className="flex flex-wrap gap-1">
                            {picks
                              .filter((name) => !usedChampions.has(name))
                              .map((name) => (
                                <Button key={name} size="xs" variant="outline" disabled={!canManage} onClick={() => setRow(key, { championName: name })}>
                                  {name}
                                </Button>
                              ))}
                          </div>
                        )}
                      </Field>
                    </div>

                    {withStats && (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {LINEUP_STAT_KEYS.map((stat) => {
                          const statProblem = problemAt(key, stat);
                          return (
                            <Field
                              key={stat}
                              label={LINEUP_OPTIONAL_STATS.has(stat) ? `${t(`stat.${stat}`)} (${t("optional")})` : t(`stat.${stat}`)}
                              htmlFor={fieldId(key, stat)}
                              error={statProblem}
                            >
                              <Input
                                id={fieldId(key, stat)}
                                inputMode="numeric"
                                value={row.stats[stat]}
                                disabled={!canManage}
                                aria-invalid={statProblem !== null}
                                onChange={(e) => setRow(key, { stats: { ...row.stats, [stat]: e.target.value } })}
                              />
                            </Field>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <Button size="xs" variant="ghost" className="self-start" aria-expanded={row.buildOpen} onClick={() => setRow(key, { buildOpen: !row.buildOpen })}>
                        {row.buildOpen ? <ChevronDownIcon className="size-3.5" /> : <ChevronRightIcon className="size-3.5" />}
                        {t("build")}
                        {!row.buildOpen && buildHasParts(row.build) && <span className="text-muted-foreground">({t("buildSet")})</span>}
                      </Button>
                      {row.buildOpen && buildSection(key, row)}
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Button onClick={save} disabled={!canManage || isPending}>
          {isPending ? t("saving") : t("save")}
        </Button>
      </div>
    </div>
  );
}

/** A labelled field with its problem, when it has one, under it in red. */
function Field({ label, htmlFor, error, children }: { label: string; htmlFor: string; error: string | null; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Label htmlFor={htmlFor} className={cn("truncate text-[11px] text-muted-foreground", error && "text-destructive")}>
        {label}
      </Label>
      {children}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

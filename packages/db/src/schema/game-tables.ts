/**
 * GC-Stats — game tables module
 *
 * Tables that exist once per game (`val_*` and `lol_*`), built by one
 * factory so both games share the exact same columns. Valorant also owns
 * the maps/stats and veto tables, LoL has no equivalent.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { sql } from "drizzle-orm";
import { pgTable, bigserial, bigint, integer, smallint, text, varchar, jsonb, boolean, date, timestamp, numeric, char, real, uuid, primaryKey, unique, uniqueIndex, index, type AnyPgColumn } from "drizzle-orm/pg-core";
import { daterange } from "./custom-types";
import { users } from "./auth";
import { organizations } from "./people";
import { newsAuthors, newsLanguages } from "./content";
import { containerTypeEnum, matchStatusEnum, slotEnum, matchResultEnum, seedSourceEnum, entryStatusEnum, stageStatusEnum } from "./bracket";
import { pickemScoringModeEnum, pickemRewardKindEnum } from "./pickem";
import type { GameSlug } from "../game";

type GamePrefix = "val" | "lol";

// `mapIdRef` is only given for Valorant, the only game with a maps table.
export function defineGameTables<const P extends GamePrefix>(p: P, mapIdRef?: () => AnyPgColumn) {
  const teams = pgTable(`${p}_teams` as `${P}_teams`, {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    name: text("name").notNull(),
    shortName: varchar("short_name", { length: 10 }),
    countryCode: char("country_code", { length: 3 }),
    // Second nationality — dual citizenship, same alpha-3/"INT" vocabulary as
    // countryCode. Display fuses both flags diagonally (CountryFlag), never a
    // second independent identifier.
    secondaryCountryCode: char("secondary_country_code", { length: 3 }),
    socials: jsonb("socials").notNull().default({}),
    bio: text("bio"),
    vlrId: integer("vlr_id"),
    isActive: boolean("is_active").notNull().default(true),
    // Out-of-coverage opponent (mix tournament): shown on its matches only.
    isGhost: boolean("is_ghost").notNull().default(false),
    maxPermissions: jsonb("max_permissions"),
    tags: jsonb("tags"),
    liquipediaLink: text("liquipedia_link"),
    // Set when data was imported from Liquipedia: shows the attribution footer on the public page.
    liquipediaSourced: boolean("liquipedia_sourced").notNull().default(false),
    // Organization running this team: the org then has no public page of its own
    // (its members show as the team's staff) and gets an automatic /dashboard
    // access scoped to the streams of this team's matches. One org can own several teams.
    organizationId: bigint("organization_id", { mode: "number" }).references((): AnyPgColumn => organizations.id, { onDelete: "set null" }),
  }, (t) => [
    index(`${p}_teams_organization_id_idx`).on(t.organizationId),
  ]);

  // Liquipedia page name <-> GC Stats team, strictly one to one: used to write
  // {{TeamOpponent|...}} in generated wikicode and to recognise teams on import.
  const liquipediaTeamNames = pgTable(
    `${p}_liquipedia_team_names` as `${P}_liquipedia_team_names`,
    {
      id: bigserial("id", { mode: "number" }).primaryKey(),
      teamId: bigint("team_id", { mode: "number" }).notNull().unique().references(() => teams.id, { onDelete: "cascade" }),
      name: text("name").notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [uniqueIndex(`${p}_liquipedia_team_names_name_lower_unique`).on(sql`lower(${t.name})`)]
  );

  const teamNameHistory = pgTable(`${p}_team_name_history` as `${P}_team_name_history`, {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    teamId: bigint("team_id", { mode: "number" }).notNull().references(() => teams.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    period: daterange("period").notNull(),
    isVisible: boolean("is_visible").notNull().default(true),
  }, (t) => [
    index(`${p}_team_name_history_team_id_idx`).on(t.teamId),
  ]);

  // Unified identity - see DATABASES.MD Â§3.2. Replaces the separate V1
  // `players`/`staff` tables: a person who competed and later casts/coaches
  // stays one row, one logo/photo history, one profile.
  const people = pgTable(`${p}_people` as `${P}_people`, {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    handle: text("handle").notNull(),
    aliases: jsonb("aliases"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    countryCode: char("country_code", { length: 3 }),
    secondaryCountryCode: char("secondary_country_code", { length: 3 }),
    pronouns: smallint("pronouns"),
    birthDate: date("birth_date"),
    bio: text("bio"),
    socials: jsonb("socials").notNull().default({}),
    valId: text("val_id").unique(), // Riot puuid - null for people who never played competitively
    esportsValId: text("esports_val_id").unique(),
    vlrId: integer("vlr_id"),
    isActive: boolean("is_active").notNull().default(true),
    // Out-of-coverage player (mix tournament): shown on its matches only.
    isGhost: boolean("is_ghost").notNull().default(false),
    userId: text("user_id").unique().references(() => users.id, { onDelete: "set null" }),
    liquipediaLink: text("liquipedia_link"),
    // Set when data was imported from Liquipedia: shows the attribution footer on the public page.
    liquipediaSourced: boolean("liquipedia_sourced").notNull().default(false),
  });

  // Name used for a person in generated Liquipedia wikicode, one to one. A person can
  // be exported without owning a Liquipedia page, so this is not tied to `liquipedia_link`.
  const liquipediaPersonNames = pgTable(
    `${p}_liquipedia_person_names` as `${P}_liquipedia_person_names`,
    {
      id: bigserial("id", { mode: "number" }).primaryKey(),
      personId: bigint("person_id", { mode: "number" }).notNull().unique().references(() => people.id, { onDelete: "cascade" }),
      name: text("name").notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [uniqueIndex(`${p}_liquipedia_person_names_name_lower_unique`).on(sql`lower(${t.name})`)]
  );

  // A team's real, continuous roster over time (players, but also
  // coach/manager/analyst - just a different `role` value, see DATABASES.MD
  // Â§3.2). NOT what determines who played a given tournament - see
  // entrant_members in bracket.ts for that.
  const rosterMemberships = pgTable(`${p}_roster_memberships` as `${P}_roster_memberships`, {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    personId: bigint("person_id", { mode: "number" }).notNull().references(() => people.id, { onDelete: "cascade" }),
    teamId: bigint("team_id", { mode: "number" }).notNull().references(() => teams.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("player"), // 'player' | 'player-igl' | 'sub' | 'coach' | 'assistant coach' | 'performance coach' | 'analyst' | 'manager'
    period: daterange("period").notNull(),
    // True once the person left the team. An open period with has_left = true means the end date is unknown.
    hasLeft: boolean("has_left").notNull().default(false),
    // Nullable: still on the roster (period stays open) but currently inactive
    // (injury, break, ...) as of this date. Replaces V1's role-suffix
    // convention ('player-inactive' as a distinct role value + stint-merging
    // logic to display it) with a plain column — same information, no
    // parallel role vocabulary to keep in sync.
    inactiveSince: date("inactive_since"),
    // EXCLUDE USING gist (person_id, team_id, role, period) added in drizzle/0000_squashed_baseline.sql
    // - same person can hold two DIFFERENT roles concurrently, not the same role twice overlapping.
    // Entries left with an unknown end date (open period + has_left) are excluded from it, see 0042.
  });

  // Purely a public "who's part of this org" credit roster (people, not
  // accounts) — mirrors a team roster, editable only from /admin. Carries NO
  // access/permission meaning: a person listed here (even role='owner') may
  // have no user account at all, or a user account with zero /dashboard
  // access. /dashboard access is a completely separate concept, see
  // organization_access below — deliberate split requested explicitly
  // (2026-09-13): "les membres... sont un visuel (comme player)".
  const organizationMemberships = pgTable(`${p}_organization_memberships` as `${P}_organization_memberships`, {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    personId: bigint("person_id", { mode: "number" }).notNull().references(() => people.id, { onDelete: "cascade" }),
    organizationId: bigint("organization_id", { mode: "number" }).notNull().references(() => organizations.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // 'admin' | 'caster' | 'observer' | 'producer' | 'editor' | ...
    period: daterange("period").notNull(),
    // EXCLUDE USING gist (person_id, organization_id, role, period) added in 0000_squashed_baseline.sql
  });

  // Replaces staff_assignments (Laravel morph, no FK integrity). Scope
  // discriminant is exactly-one-of the nullable FKs below, enforced by a
  // CHECK (num_nonnulls(...) = 1) added in drizzle/0000_squashed_baseline.sql -
  // same pattern as entrants.kind / stage_qualifications.
  const productionCredits = pgTable(`${p}_production_credits` as `${P}_production_credits`, {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    personId: bigint("person_id", { mode: "number" }).notNull().references(() => people.id, { onDelete: "cascade" }),
    organizationId: bigint("organization_id", { mode: "number" }).references(() => organizations.id, { onDelete: "set null" }),
    role: text("role").notNull(), // 'caster' | 'analyst' | 'host' | 'observer' | 'organizer' | 'producer' | 'editor' | 'photographer' | 'translator' | 'referee' | ...
    titleOverride: text("title_override"),
    tournamentId: bigint("tournament_id", { mode: "number" }), // FK added once tournaments exists (bracket.ts) - see 0000_squashed_baseline.sql
    stageId: bigint("stage_id", { mode: "number" }),
    containerId: bigint("container_id", { mode: "number" }),
    matchId: bigint("match_id", { mode: "number" }),
    mapId: bigint("map_id", { mode: "number" }),
  }, (t) => [
    index(`${p}_production_credits_tournament_id_idx`).on(t.tournamentId),
    index(`${p}_production_credits_match_id_idx`).on(t.matchId),
  ]);

  const pointTypes = pgTable(`${p}_point_types` as `${P}_point_types`, {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    name: text("name").notNull(),
    label: text("label").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
  });

  const tournaments = pgTable(`${p}_tournaments` as `${P}_tournaments`, {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    name: text("name").notNull(),
    region: text("region"),
    category: text("category"),
    prizePool: text("prize_pool"),
    location: text("location"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    status: text("status").notNull().default("upcoming"), // 'upcoming' | 'live' | 'finished'
    description: text("description"),
    // Extra search terms (abbreviations, former names) matched by the searches.
    keywords: text("keywords").array().notNull().default([]),
    active: boolean("active").notNull().default(false),
    // Uncovered tournament (mix) holding a GC team's match: only the match is
    // public, the tournament has no page and stays out of every listing.
    isGhost: boolean("is_ghost").notNull().default(false),
    liquipediaLink: text("liquipedia_link"),
    socials: jsonb("socials").notNull().default({}),
    playerPovPhrase: text("player_pov_phrase"),
    pointTypeId: bigint("point_type_id", { mode: "number" }).references(() => pointTypes.id, { onDelete: "set null" }),
    // Organization shown as the tournament's organizer.
    organizerOrganizationId: bigint("organizer_organization_id", { mode: "number" }).references(() => organizations.id, { onDelete: "set null" }),
    // Enabled by a site admin, then managed by the organizer from the dashboard.
    vetoEnabled: boolean("veto_enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => [
    index(`${p}_tournaments_active_start_date_idx`).on(t.active, t.startDate),
    index(`${p}_tournaments_organizer_organization_id_idx`).on(t.organizerOrganizationId),
  ]);

  // Mirrors component-registry selections (veto system, standings calculator,
  // auth provider, ...) — absence of a row for a `kind` is a valid state.
  const tournamentComponents = pgTable(`${p}_tournament_components` as `${P}_tournament_components`, {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tournamentId: bigint("tournament_id", { mode: "number" }).notNull().references(() => tournaments.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 64 }).notNull(),
    componentId: varchar("component_id", { length: 64 }).notNull(),
    enabled: boolean("enabled").notNull().default(true),
    config: jsonb("config"),
  });

  const stages = pgTable(`${p}_stages` as `${P}_stages`, {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tournamentId: bigint("tournament_id", { mode: "number" }).notNull().references(() => tournaments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sequenceOrder: integer("sequence_order").notNull(),
    status: stageStatusEnum("status").notNull().default("pending"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    // Public-visibility toggle, mirrors tournaments.active — unlike that
    // column this defaults to true (not false): existing stages must stay
    // visible after this column is added, only an explicit deactivation
    // should hide one going forward. Purely a display switch, never gates
    // admin editing.
    active: boolean("active").notNull().default(true),
    liquipediaLink: text("liquipedia_link"),
  }, (t) => [
    index(`${p}_stages_tournament_id_idx`).on(t.tournamentId),
  ]);

  const stageContainers = pgTable(`${p}_stage_containers` as `${P}_stage_containers`, {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    stageId: bigint("stage_id", { mode: "number" }).notNull().references(() => stages.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    containerType: containerTypeEnum("container_type").notNull(),
    config: jsonb("config").notNull().default({}),
    status: stageStatusEnum("status").notNull().default("pending"),
    // Position within its stage, set by the admin (ties broken by id).
    displayOrder: integer("display_order").notNull().default(0),
    // Liquipedia bracket template (`Bracket/8U4L2DSL1D`) this container is drawn with.
    liquipediaBracketTemplate: text("liquipedia_bracket_template"),
  }, (t) => [
    index(`${p}_stage_containers_stage_id_idx`).on(t.stageId),
  ]);

  // --- Entrants -------------------------------------------------------------
  // GC-Stats never uses kind='player' — a Valorant tournament always registers
  // by team. Kept in the shared type only for BRACKT's future solo-game use.
  // See DATABASES.MD §2.3. CHECK (exactly one of team_id/player_id per kind)
  // added in drizzle/0000_squashed_baseline.sql.
  const entrants = pgTable(`${p}_entrants` as `${P}_entrants`, {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tournamentId: bigint("tournament_id", { mode: "number" }).notNull().references(() => tournaments.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // 'team' | 'player' | 'placeholder' — GC-Stats only ever writes 'team'/'placeholder'
    teamId: bigint("team_id", { mode: "number" }).references(() => teams.id),
    playerId: bigint("player_id", { mode: "number" }).references(() => people.id),
    displayName: text("display_name").notNull(), // snapshot at registration time, survives a later team rename
    seed: integer("seed"),
    // When false, the source is derived from the qualification rules at read time
    // and the two columns below are ignored; when true they are the admin's choice.
    qualificationSourceManual: boolean("qualification_source_manual").notNull().default(false),
    qualificationSourceType: text("qualification_source_type"), // 'tournament' | 'invite' | 'points'
    qualificationSourceTournamentId: bigint("qualification_source_tournament_id", { mode: "number" }).references(() => tournaments.id, { onDelete: "set null" }),
    qualificationSourcePointTypeId: bigint("qualification_source_point_type_id", { mode: "number" }).references(() => pointTypes.id, { onDelete: "set null" }),
    // Secret of the team's public veto link, valid for the whole tournament.
    vetoToken: text("veto_token").unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => [
    index(`${p}_entrants_tournament_id_idx`).on(t.tournamentId),
    index(`${p}_entrants_team_id_idx`).on(t.teamId),
  ]);

  // The roster locked in for THIS tournament — distinct from the team's
  // ongoing roster (rosterMemberships). See DATABASES.MD §2.3bis.
  const entrantMembers = pgTable(`${p}_entrant_members` as `${P}_entrant_members`, {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    entrantId: bigint("entrant_id", { mode: "number" }).notNull().references(() => entrants.id, { onDelete: "cascade" }),
    personId: bigint("person_id", { mode: "number" }).notNull().references(() => people.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("player"), // 'player' | 'stand_in' | 'coach' | 'manager' | 'analyst' | ...
    isStarter: boolean("is_starter").notNull().default(true),
  }, (t) => [
    unique(`${p}_entrant_members_entrant_person_role_unique`).on(t.entrantId, t.personId, t.role),
  ]);

  const groupEntries = pgTable(`${p}_group_entries` as `${P}_group_entries`, {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    containerId: bigint("container_id", { mode: "number" }).notNull().references(() => stageContainers.id, { onDelete: "cascade" }),
    entrantId: bigint("entrant_id", { mode: "number" }).notNull().references(() => entrants.id, { onDelete: "cascade" }),
    seed: integer("seed"),
    wins: integer("wins").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    buchholz: integer("buchholz").notNull().default(0), // hundredths, no float
    roundDiff: integer("round_diff").notNull().default(0),
    hadBye: boolean("had_bye").notNull().default(false),
    status: entryStatusEnum("status").notNull().default("active"),
  }, (t) => [
    index(`${p}_group_entries_container_id_idx`).on(t.containerId),
  ]);

  const containerStandingsRules = pgTable(`${p}_container_standings_rules` as `${P}_container_standings_rules`, {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    containerId: bigint("container_id", { mode: "number" }).notNull().references(() => stageContainers.id, { onDelete: "cascade" }),
    criteria: jsonb("criteria").notNull(), // ordered, e.g. ["buchholz", "round_diff", "seed"]
  });

  const matches = pgTable(`${p}_matches` as `${P}_matches`, {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    containerId: bigint("container_id", { mode: "number" }).notNull().references(() => stageContainers.id, { onDelete: "cascade" }),
    round: integer("round").notNull(),
    // Row position within its (container, round) column on the admin bracket
    // editor canvas — purely a manual layout hint (null = auto-placed in the
    // next free row), never read by the bracket engine or the public/pickem/
    // admin-viewer canvases (those derive their own row from the graph shape,
    // cf. lib/bracket-layout.ts).
    displayOrder: integer("display_order"),
    label: text("label"),
    bestOf: integer("best_of").notNull().default(1),
    status: matchStatusEnum("status").notNull().default("pending"),
    entrantAId: bigint("entrant_a_id", { mode: "number" }).references(() => entrants.id),
    entrantBId: bigint("entrant_b_id", { mode: "number" }).references(() => entrants.id),
    scoreA: integer("score_a"),
    scoreB: integer("score_b"),
    winnerId: bigint("winner_id", { mode: "number" }).references(() => entrants.id),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    patch: text("patch"),
    // Drives the optional "forfeit win" point value in a group container's
    // points-based tiebreaker (apps/web/src/lib/bracket/points.ts) — a
    // forfeited match still has a winnerId, this just flags that the win
    // didn't come from actually playing it out.
    isForfeit: boolean("is_forfeit").notNull().default(false),
  }, (t) => [
    index(`${p}_matches_container_id_idx`).on(t.containerId),
    index(`${p}_matches_entrant_a_id_idx`).on(t.entrantAId),
    index(`${p}_matches_entrant_b_id_idx`).on(t.entrantBId),
  ]);

  const matchSeeds = pgTable(`${p}_match_seeds` as `${P}_match_seeds`, {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    matchId: bigint("match_id", { mode: "number" }).notNull().references(() => matches.id, { onDelete: "cascade" }),
    slot: slotEnum("slot").notNull(),
    sourceType: seedSourceEnum("source_type").notNull(),
    sourceRef: jsonb("source_ref").notNull(), // {seed:3} | {containerId,rank} | {} (bye) | {qualificationId}
  }, (t) => [
    index(`${p}_match_seeds_match_id_idx`).on(t.matchId),
  ]);

  const bracketEdges = pgTable(`${p}_bracket_edges` as `${P}_bracket_edges`, {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    fromMatchId: bigint("from_match_id", { mode: "number" }).notNull().references(() => matches.id, { onDelete: "cascade" }),
    fromResult: matchResultEnum("from_result").notNull(),
    toMatchId: bigint("to_match_id", { mode: "number" }).notNull().references(() => matches.id, { onDelete: "cascade" }),
    toSlot: slotEnum("to_slot").notNull(),
  }, (t) => [
    index(`${p}_bracket_edges_from_match_id_idx`).on(t.fromMatchId),
    index(`${p}_bracket_edges_to_match_id_idx`).on(t.toMatchId),
  ]);

  // Stage-level qualification/advancement rules — ported from V1
  // phase_qualifications (see DATABASES.MD §2.6). CHECK (exactly one of
  // source_container_id/source_match_id) added in 0000_squashed_baseline.sql.
  const stageQualifications = pgTable(`${p}_stage_qualifications` as `${P}_stage_qualifications`, {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sourceContainerId: bigint("source_container_id", { mode: "number" }).references(() => stageContainers.id, { onDelete: "cascade" }),
    rankFrom: integer("rank_from"),
    rankTo: integer("rank_to"),
    sourceMatchId: bigint("source_match_id", { mode: "number" }).references(() => matches.id, { onDelete: "cascade" }),
    outcome: matchResultEnum("outcome"),
    destinationType: text("destination_type").notNull(), // 'container' | 'placement'
    destinationContainerId: bigint("destination_container_id", { mode: "number" }).references(() => stageContainers.id, { onDelete: "cascade" }), // may be in ANOTHER tournament
    placement: integer("placement"),
    placementLabel: text("placement_label"),
    points: integer("points"),
    cashPrizeAmount: numeric("cash_prize_amount", { precision: 12, scale: 2 }),
    cashPrizeCurrency: varchar("cash_prize_currency", { length: 8 }), // symbol (€, $, £, ...), not an ISO code
  }, (t) => [
    index(`${p}_stage_qualifications_source_container_id_idx`).on(t.sourceContainerId),
  ]);

  const qualificationResults = pgTable(`${p}_qualification_results` as `${P}_qualification_results`, {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    qualificationId: bigint("qualification_id", { mode: "number" }).notNull().references(() => stageQualifications.id, { onDelete: "cascade" }),
    entrantId: bigint("entrant_id", { mode: "number" }).notNull().references(() => entrants.id, { onDelete: "cascade" }),
    rank: integer("rank"),
  }, (t) => [
    index(`${p}_qualification_results_entrant_id_idx`).on(t.entrantId),
    unique(`${p}_qualification_results_qualification_entrant_unique`).on(t.qualificationId, t.entrantId),
  ]);

  const pointEntries = pgTable(`${p}_point_entries` as `${P}_point_entries`, {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    teamId: bigint("team_id", { mode: "number" }).notNull().references(() => teams.id, { onDelete: "cascade" }),
    pointTypeId: bigint("point_type_id", { mode: "number" }).notNull().references(() => pointTypes.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(), // signed ledger entry, SUM not counter
    qualificationResultId: bigint("qualification_result_id", { mode: "number" }).references(() => qualificationResults.id, { onDelete: "cascade" }),
    reason: text("reason"),
  });

  const news = pgTable(`${p}_news` as `${P}_news`, {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    authorId: bigint("author_id", { mode: "number" }).references(() => newsAuthors.id),
    // Organizations replace V1's news_publishers (same real ids already) — an
    // org with the 'media'/'production' tag doubles as an outlet, no separate
    // publisher entity needed.
    organizationId: bigint("organization_id", { mode: "number" }).references(() => organizations.id, { onDelete: "set null" }),
    lang: varchar("lang", { length: 10 }).notNull().default("en").references(() => newsLanguages.code),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    excerpt: text("excerpt"),
    content: text("content").notNull(),
    imageCover: text("image_cover"),
    // 'draft' | 'in_review' | 'changes_requested' | 'approved' | 'published' | 'archived'.
    // The review states only ever apply to an organization-scoped article
    // (organization.news.edit submits, organization.news.review approves or
    // requests changes, organization.news.publish puts an approved article
    // live) — an individual /dashboard/author article has a single trusted
    // actor and always goes straight draft -> published, see resolveScope in
    // actions/dashboard-news.ts.
    status: text("status").notNull().default("draft"),
    isFeatured: boolean("is_featured").notNull().default(false),
    showOnHome: boolean("show_on_home").notNull().default(true),
    // A future publishedAt is how "schedule this for later" is represented —
    // status flips to 'published' immediately once approved, but every public
    // read site also requires publishedAt <= now() (see news-page-data.ts and
    // friends), so a future timestamp keeps it invisible until due without
    // needing any background job to flip a status flag.
    publishedAt: timestamp("published_at", { withTimezone: true }),
    submittedBy: text("submitted_by").references(() => users.id, { onDelete: "set null" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedBy: text("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => [
    index(`${p}_news_home_idx`).on(t.showOnHome, t.status, t.publishedAt),
  ]);

  // Private conversation attached to one article — visible only to whoever can
  // reach its /dashboard editor (never public). Doubles as the audit trail for
  // the approval workflow: a status transition (submit/approve/request
  // changes/publish) posts a system row here alongside free-text comments,
  // distinguished by `type`, mirroring change_request_messages' own
  // comment/system split above.
  const newsMessages = pgTable(`${p}_news_messages` as `${P}_news_messages`, {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    newsId: bigint("news_id", { mode: "number" }).notNull().references(() => news.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    type: text("type").notNull().default("comment"), // 'comment' | 'submitted' | 'approved' | 'changes_requested' | 'published' | 'scheduled' | 'unpublished'
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  });

  const newsRelations = pgTable(`${p}_news_relations` as `${P}_news_relations`, {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    newsId: bigint("news_id", { mode: "number" }).notNull().references(() => news.id, { onDelete: "cascade" }),
    relatableType: text("relatable_type").notNull(), // 'team' | 'person' | 'tournament'
    relatableId: bigint("relatable_id", { mode: "number" }).notNull(),
  }, (t) => [
    index(`${p}_news_relations_relatable_idx`).on(t.relatableType, t.relatableId),
  ]);

  const newsImages = pgTable(`${p}_news_images` as `${P}_news_images`, {
    id: uuid("id").primaryKey().defaultRandom(),
    newsId: bigint("news_id", { mode: "number" }).references(() => news.id, { onDelete: "set null" }),
    authorId: bigint("author_id", { mode: "number" }).references(() => newsAuthors.id, { onDelete: "set null" }),
  });

  // --- Change requests (crowdsourced edits) -----------------------------------
  const changeRequests = pgTable(`${p}_change_requests` as `${P}_change_requests`, {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    subjectType: text("subject_type").notNull(),
    subjectId: bigint("subject_id", { mode: "number" }).notNull(),
    requestedBy: text("requested_by").references(() => users.id, { onDelete: "set null" }),
    reason: text("reason"),
    status: text("status").notNull().default("pending"),
    closedBy: text("closed_by").references(() => users.id, { onDelete: "set null" }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    sanctionedAt: timestamp("sanctioned_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  });

  const changeRequestItems = pgTable(`${p}_change_request_items` as `${P}_change_request_items`, {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    changeRequestId: bigint("change_request_id", { mode: "number" }).notNull().references(() => changeRequests.id, { onDelete: "cascade" }),
    field: text("field").notNull(),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    status: text("status").notNull().default("pending"),
    resolvedBy: text("resolved_by").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolutionNote: text("resolution_note"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    applyError: text("apply_error"),
  });

  const changeRequestMessages = pgTable(`${p}_change_request_messages` as `${P}_change_request_messages`, {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    changeRequestId: bigint("change_request_id", { mode: "number" }).notNull().references(() => changeRequests.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    type: text("type").notNull().default("comment"),
    body: text("body").notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
  });

  // One row per change request awaiting its Discord decision notice. Every
  // item resolution that closes the request upserts this (pushing scheduledAt
  // forward), so several items resolved close together coalesce into a single
  // Discord message instead of one per item — see lib/notify.ts and
  // scheduled-jobs/jobs/flush-change-request-discord-notices.ts.
  const changeRequestDiscordNotices = pgTable(`${p}_change_request_discord_notices` as `${P}_change_request_discord_notices`, {
    changeRequestId: bigint("change_request_id", { mode: "number" })
      .primaryKey()
      .references(() => changeRequests.id, { onDelete: "cascade" }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  });

  const streamChannels = pgTable(`${p}_stream_channels` as `${P}_stream_channels`, {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    organizationId: bigint("organization_id", { mode: "number" }).references(() => organizations.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    platform: text("platform").notNull(), // 'youtube' | 'twitch' | 'tiktok' | 'kick'
    type: text("type").notNull().default("official"), // 'official' | 'watchparty'
    url: text("url").notNull(),
    languageCode: char("language_code", { length: 5 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
  });

  const matchStreams = pgTable(
    `${p}_match_streams` as `${P}_match_streams`,
    {
      matchId: bigint("match_id", { mode: "number" }).notNull().references(() => matches.id, { onDelete: "cascade" }),
      streamChannelId: bigint("stream_channel_id", { mode: "number" }).notNull().references(() => streamChannels.id, { onDelete: "cascade" }),
    },
    (t) => [primaryKey({ columns: [t.matchId, t.streamChannelId] })]
  );

  const vods = pgTable(`${p}_vods` as `${P}_vods`, {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    matchId: bigint("match_id", { mode: "number" }).notNull().references(() => matches.id, { onDelete: "cascade" }),
    mapId: mapIdRef ? bigint("map_id", { mode: "number" }).references(mapIdRef, { onDelete: "set null" }) : bigint("map_id", { mode: "number" }), // null = whole-match VOD
    organizationId: bigint("organization_id", { mode: "number" }).references(() => organizations.id, { onDelete: "set null" }),
    url: text("url").notNull(),
    languageCode: char("language_code", { length: 5 }).notNull(),
  }, (t) => [
    index(`${p}_vods_match_id_idx`).on(t.matchId),
  ]);

  const matchPlayerPovs = pgTable(`${p}_match_player_povs` as `${P}_match_player_povs`, {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    matchId: bigint("match_id", { mode: "number" }).notNull().references(() => matches.id, { onDelete: "cascade" }),
    entrantId: bigint("entrant_id", { mode: "number" }).notNull(),
    personId: bigint("person_id", { mode: "number" }).references(() => people.id, { onDelete: "cascade" }), // null = the team's own channel
    twitchLogin: text("twitch_login").notNull(),
    title: text("title"),
    url: text("url").notNull(),
    lastSeenLiveAt: timestamp("last_seen_live_at", { withTimezone: true }),
  }, (t) => [
    unique(`${p}_match_player_povs_match_login_unique`).on(t.matchId, t.twitchLogin),
  ]);

  // Per-stage (phase) pick'em configuration, admin only. Predictions open at
  // `opensAt`; they close at the stage's own earliest match `scheduledAt`
  // (computed at read time from `matches`, never stored — a match can be
  // rescheduled after this row is created).
  const pickemStageSettings = pgTable(
    `${p}_pickem_stage_settings` as `${P}_pickem_stage_settings`,
    {
      id: bigserial("id", { mode: "number" }).primaryKey(),
      stageId: bigint("stage_id", { mode: "number" }).notNull().references(() => stages.id, { onDelete: "cascade" }),
      enabled: boolean("enabled").notNull().default(false),
      opensAt: timestamp("opens_at", { withTimezone: true }).notNull(),
    },
    (t) => [unique(`${p}_pickem_stage_settings_stage_unique`).on(t.stageId)]
  );

  // A group is scoped to one tournament — its leaderboard spans every
  // pick'em-enabled stage of that tournament only.
  const pickemGroups = pgTable(
    `${p}_pickem_groups` as `${P}_pickem_groups`,
    {
      id: bigserial("id", { mode: "number" }).primaryKey(),
      tournamentId: bigint("tournament_id", { mode: "number" }).notNull().references(() => tournaments.id, { onDelete: "cascade" }),
      name: text("name").notNull(),
      ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      scoringMode: pickemScoringModeEnum("scoring_mode").notNull().default("default"),
      joinCode: varchar("join_code", { length: 12 }).notNull(),
      createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [unique(`${p}_pickem_groups_join_code_unique`).on(t.joinCode)]
  );

  const pickemGroupMembers = pgTable(
    `${p}_pickem_group_members` as `${P}_pickem_group_members`,
    {
      id: bigserial("id", { mode: "number" }).primaryKey(),
      groupId: bigint("group_id", { mode: "number" }).notNull().references(() => pickemGroups.id, { onDelete: "cascade" }),
      userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [unique(`${p}_pickem_group_members_group_user_unique`).on(t.groupId, t.userId)]
  );

  // Custom points for one phase of a group — a row only exists when the group
  // opted into scoringMode='custom' for that stage. Missing row (default mode,
  // or custom mode without an explicit override yet) falls back to
  // lib/pickem/scoring.ts::DEFAULT_PICKEM_SCORING.
  const pickemGroupPhasePoints = pgTable(
    `${p}_pickem_group_phase_points` as `${P}_pickem_group_phase_points`,
    {
      id: bigserial("id", { mode: "number" }).primaryKey(),
      groupId: bigint("group_id", { mode: "number" }).notNull().references(() => pickemGroups.id, { onDelete: "cascade" }),
      stageId: bigint("stage_id", { mode: "number" }).notNull().references(() => stages.id, { onDelete: "cascade" }),
      teamCorrectPoints: integer("team_correct_points").notNull(),
      outcomeCorrectPoints: integer("outcome_correct_points").notNull(),
      advancementPerRoundPoints: integer("advancement_per_round_points").notNull(),
      standingRankPoints: integer("standing_rank_points").notNull(),
    },
    (t) => [unique(`${p}_pickem_group_phase_points_group_stage_unique`).on(t.groupId, t.stageId)]
  );

  // One predicted winner per bracket-container match. Locked once the stage's
  // pick'em window closes (first match of the stage) — enforced in
  // lib/pickem/pickem-data.ts, not by a DB constraint (the lock deadline
  // moves with matches.scheduledAt).
  const pickemMatchPicks = pgTable(
    `${p}_pickem_match_picks` as `${P}_pickem_match_picks`,
    {
      id: bigserial("id", { mode: "number" }).primaryKey(),
      userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      stageId: bigint("stage_id", { mode: "number" }).notNull().references(() => stages.id, { onDelete: "cascade" }),
      matchId: bigint("match_id", { mode: "number" }).notNull().references(() => matches.id, { onDelete: "cascade" }),
      predictedWinnerEntrantId: bigint("predicted_winner_entrant_id", { mode: "number" }).notNull().references(() => entrants.id, { onDelete: "cascade" }),
      updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [unique(`${p}_pickem_match_picks_user_match_unique`).on(t.userId, t.matchId)]
  );

  // One predicted final rank per entrant of a group/Swiss/round-robin
  // container — "1er/2e/3e/etc", not a match by match prediction.
  const pickemStandingPicks = pgTable(
    `${p}_pickem_standing_picks` as `${P}_pickem_standing_picks`,
    {
      id: bigserial("id", { mode: "number" }).primaryKey(),
      userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      stageId: bigint("stage_id", { mode: "number" }).notNull().references(() => stages.id, { onDelete: "cascade" }),
      containerId: bigint("container_id", { mode: "number" }).notNull().references(() => stageContainers.id, { onDelete: "cascade" }),
      entrantId: bigint("entrant_id", { mode: "number" }).notNull().references(() => entrants.id, { onDelete: "cascade" }),
      predictedRank: integer("predicted_rank").notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
      unique(`${p}_pickem_standing_picks_user_container_entrant_unique`).on(t.userId, t.containerId, t.entrantId),
      unique(`${p}_pickem_standing_picks_user_container_rank_unique`).on(t.userId, t.containerId, t.predictedRank),
    ]
  );

  // Awarded once against the PUBLIC default-scoring leaderboard only (never a
  // custom group's) — kept simple and comparable across
  // every participant of a stage. Computed lazily (lib/pickem/rewards.ts) the
  // first time the stage's pick'em results are viewed after it completes.
  const pickemRewards = pgTable(
    `${p}_pickem_rewards` as `${P}_pickem_rewards`,
    {
      id: bigserial("id", { mode: "number" }).primaryKey(),
      userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      stageId: bigint("stage_id", { mode: "number" }).notNull().references(() => stages.id, { onDelete: "cascade" }),
      kind: pickemRewardKindEnum("kind").notNull(),
      awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [unique(`${p}_pickem_rewards_user_stage_kind_unique`).on(t.userId, t.stageId, t.kind)]
  );

  return { teams, liquipediaTeamNames, teamNameHistory, people, liquipediaPersonNames, rosterMemberships, organizationMemberships, productionCredits, pointTypes, tournaments, tournamentComponents, stages, stageContainers, entrants, entrantMembers, groupEntries, containerStandingsRules, matches, matchSeeds, bracketEdges, stageQualifications, qualificationResults, pointEntries, news, newsMessages, newsRelations, newsImages, changeRequests, changeRequestItems, changeRequestMessages, changeRequestDiscordNotices, streamChannels, matchStreams, vods, matchPlayerPovs, pickemStageSettings, pickemGroups, pickemGroupMembers, pickemGroupPhasePoints, pickemMatchPicks, pickemStandingPicks, pickemRewards };
}

export type GameTables = ReturnType<typeof defineGameTables<"val">>;

// Valorant only: maps, raw/aggregated stats from the Riot relay, and the veto system.
export function defineValorantTables(g: GameTables) {
  const { matches, entrants, people, tournaments } = g;

  // --- Maps (one per bracket-engine match, best-of-N) -----------------------
  const maps = pgTable("val_maps", {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    matchId: bigint("match_id", { mode: "number" }).notNull().references(() => matches.id, { onDelete: "cascade" }),
    apiMatchId: text("api_match_id").unique(), // Riot match id, or RiotRelay's synthetic "GCS-..." merged id
    mapName: text("map_name"), // display name, e.g. "Ascent" — see reference tables note above
    gameMode: text("game_mode"), // matchInfo.gameMode from Riot payload — stored even though only Bomb is used today
    teamAScore: integer("team_a_score"),
    teamBScore: integer("team_b_score"),
    order: integer("order").notNull(),
    isCompleted: boolean("is_completed").notNull().default(false),
    startedAt: timestamp("started_at", { withTimezone: true }),
    note: text("note"),
    // Same purpose as matches.isForfeit, one level down — a map-win point
    // value can differ from a map-forfeit-win value in a group container's
    // points tiebreaker (apps/web/src/lib/bracket/points.ts).
    isForfeit: boolean("is_forfeit").notNull().default(false),
  }, (t) => [
    index("val_maps_match_id_idx").on(t.matchId),
  ]);

  const mapRoundsRaw = pgTable("val_map_rounds_raw", {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    mapId: bigint("map_id", { mode: "number" }).notNull().references(() => maps.id, { onDelete: "cascade" }),
    roundNumber: integer("round_number").notNull(),
    winningEntrantId: bigint("winning_entrant_id", { mode: "number" }).references(() => entrants.id),
    winType: text("win_type"), // elimination | defuse | detonate | time
    atkEntrantId: bigint("atk_entrant_id", { mode: "number" }).references(() => entrants.id),
    defEntrantId: bigint("def_entrant_id", { mode: "number" }).references(() => entrants.id),
    plantSite: text("plant_site"),
    plantX: integer("plant_x"),
    plantY: integer("plant_y"),
    plantTimeMs: integer("plant_time_ms"),
  }, (t) => [
    index("val_map_rounds_raw_map_id_idx").on(t.mapId),
  ]);

  const mapRoundKillsRaw = pgTable("val_map_round_kills_raw", {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    mapRoundId: bigint("map_round_id", { mode: "number" }).notNull().references(() => mapRoundsRaw.id, { onDelete: "cascade" }),
    killerPersonId: bigint("killer_person_id", { mode: "number" }).references(() => people.id),
    victimPersonId: bigint("victim_person_id", { mode: "number" }).notNull().references(() => people.id),
    timeMs: integer("time_ms").notNull(),
    weapon: text("weapon"), // display name, e.g. "Vandal" — see reference tables note above
    damageType: text("damage_type"), // Weapon | Ability | Bomb | Melee | Fall
    isSecondaryFire: boolean("is_secondary_fire"),
    assistantPersonIds: bigint("assistant_person_ids", { mode: "number" }).array(),
  }, (t) => [
    index("val_map_round_kills_raw_map_round_id_idx").on(t.mapRoundId),
  ]);

  const mapRoundDamagesRaw = pgTable("val_map_round_damages_raw", {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    mapRoundId: bigint("map_round_id", { mode: "number" }).notNull().references(() => mapRoundsRaw.id, { onDelete: "cascade" }),
    attackerPersonId: bigint("attacker_person_id", { mode: "number" }).references(() => people.id),
    receiverPersonId: bigint("receiver_person_id", { mode: "number" }).notNull().references(() => people.id),
    damage: integer("damage").notNull(),
    headshots: integer("headshots").notNull().default(0),
    bodyshots: integer("bodyshots").notNull().default(0),
    legshots: integer("legshots").notNull().default(0),
  }, (t) => [
    index("val_map_round_damages_raw_map_round_id_idx").on(t.mapRoundId),
  ]);

  const mapRoundAliveStatesRaw = pgTable("val_map_round_alive_states_raw", {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    mapRoundId: bigint("map_round_id", { mode: "number" }).notNull().references(() => mapRoundsRaw.id, { onDelete: "cascade" }),
    sequence: smallint("sequence").notNull(),
    timeMs: integer("time_ms").notNull(),
    atkAlive: smallint("atk_alive").notNull(),
    defAlive: smallint("def_alive").notNull(),
    winnerSide: text("winner_side"), // 'atk' | 'def'
  }, (t) => [
    index("val_map_round_alive_states_raw_map_round_id_idx").on(t.mapRoundId),
  ]);

  // The heatmap exception — full granularity kept indefinitely, never archived
  // (see DATABASES.MD §4.1). `playerLocations` on a real Riot kill event
  // includes every alive player, not just killer/victim — hence `role`
  // covering 'bystander' too (see DATABASES.MD §4.4).
  const mapRoundPlayerPositionsRaw = pgTable("val_map_round_player_positions_raw", {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    mapRoundId: bigint("map_round_id", { mode: "number" }).notNull().references(() => mapRoundsRaw.id, { onDelete: "cascade" }),
    mapId: bigint("map_id", { mode: "number" }).notNull().references(() => maps.id), // denormalized for indexed heatmap filtering
    eventType: text("event_type").notNull(), // 'kill' | 'plant' | 'defuse'
    mapRoundKillId: bigint("map_round_kill_id", { mode: "number" }).references(() => mapRoundKillsRaw.id, { onDelete: "set null" }),
    personId: bigint("person_id", { mode: "number" }).notNull().references(() => people.id),
    role: text("role"), // 'killer' | 'victim' | 'bystander' | 'planter' | 'defuser'
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    viewRadians: real("view_radians"),
    timeMs: integer("time_ms"),
  }, (t) => [
    index("val_map_round_player_positions_raw_map_round_id_idx").on(t.mapRoundId),
    index("val_map_round_player_positions_raw_map_round_kill_id_idx").on(t.mapRoundKillId),
  ]);

  const mapRoundPlayerLoadoutsRaw = pgTable("val_map_round_player_loadouts_raw", {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    mapRoundId: bigint("map_round_id", { mode: "number" }).notNull().references(() => mapRoundsRaw.id, { onDelete: "cascade" }),
    personId: bigint("person_id", { mode: "number" }).notNull().references(() => people.id, { onDelete: "cascade" }),
    entrantId: bigint("entrant_id", { mode: "number" }).references(() => entrants.id),
    kills: integer("kills").notNull().default(0),
    assists: integer("assists").notNull().default(0),
    score: integer("score").notNull().default(0),
    loadoutValue: integer("loadout_value"),
    economySpent: integer("economy_spent"),
    economyRemaining: integer("economy_remaining"),
    weapon: text("weapon"), // display name — see reference tables note above
    armor: text("armor"),
  }, (t) => [
    index("val_map_round_player_loadouts_raw_map_round_id_idx").on(t.mapRoundId),
  ]);

  const mapPlayerStats = pgTable("val_map_player_stats", {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    mapId: bigint("map_id", { mode: "number" }).notNull().references(() => maps.id, { onDelete: "cascade" }),
    personId: bigint("person_id", { mode: "number" }).references(() => people.id),
    entrantId: bigint("entrant_id", { mode: "number" }).notNull().references(() => entrants.id),
    agentName: text("agent_name"), // display name, e.g. "Jett" — see reference tables note above
    valName: text("val_name"),
    kills: integer("kills").notNull().default(0),
    deaths: integer("deaths").notNull().default(0),
    assists: integer("assists").notNull().default(0),
    acs: integer("acs").notNull().default(0),
    adr: integer("adr").notNull().default(0),
    kastPercentage: numeric("kast_percentage", { precision: 5, scale: 2 }).notNull().default("0"),
    firstKills: integer("first_kills").notNull().default(0),
    firstDeaths: integer("first_deaths").notNull().default(0),
    headshotPercentage: numeric("headshot_percentage", { precision: 5, scale: 2 }).notNull().default("0"),
    clutches: jsonb("clutches").notNull().default({}), // {"1v1": {won, total}, ...}
    multikills: jsonb("multikills").notNull().default({}), // {"2k": n, "3k": n, ...}
    tradeKills: integer("trade_kills").notNull().default(0),
    tradedDeaths: integer("traded_deaths").notNull().default(0),
    roundTypeSplits: jsonb("round_type_splits").notNull().default({}), // {"pistol": {won, played}, "atk": {rounds, roundsWon, kills, kast}, ...}
    abilityKills: jsonb("ability_kills").notNull().default({}), // {"ability1": n, "ability2": n, "grenade": n, "ultimate": n}
    fallDeaths: integer("fall_deaths").notNull().default(0),
    weaponKills: jsonb("weapon_kills").notNull().default({}), // {"<weapon name>": n, ...}
  }, (t) => [
    index("val_map_player_stats_map_id_idx").on(t.mapId),
  ]);

  const mapTeamRoundSummary = pgTable("val_map_team_round_summary", {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    mapId: bigint("map_id", { mode: "number" }).notNull().references(() => maps.id, { onDelete: "cascade" }),
    entrantId: bigint("entrant_id", { mode: "number" }).notNull().references(() => entrants.id),
    side: text("side").notNull(), // 'atk' | 'def'
    roundsPlayed: integer("rounds_played").notNull().default(0),
    roundsWon: integer("rounds_won").notNull().default(0),
  }, (t) => [
    index("val_map_team_round_summary_map_id_idx").on(t.mapId),
    index("val_map_team_round_summary_entrant_id_idx").on(t.entrantId),
  ]);

  // --- Match vetos (GC-Stats-specific, not shared with BRACKT) -------------
  const matchVetos = pgTable("val_match_vetos", {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    matchId: bigint("match_id", { mode: "number" }).notNull().references(() => matches.id, { onDelete: "cascade" }),
    entrantId: bigint("entrant_id", { mode: "number" }).notNull().references(() => entrants.id),
    mapName: text("map_name").notNull(),
    type: text("type").notNull(), // 'pick' | 'ban' | 'decider'
    order: integer("order").notNull(),
    side: char("side", { length: 3 }), // 'atk' | 'def'
    sidePickedByEntrantId: bigint("side_picked_by_entrant_id", { mode: "number" }).references(() => entrants.id),
  }, (t) => [
    index("val_match_vetos_match_id_idx").on(t.matchId),
  ]);

  // Who vetoes first: 'coin_toss' (the toss picks the team), 'coin_toss_winner' (the
  // toss winner picks the team), 'advantage' (the advantaged entrant picks), 'predefined' (slot a or b).
  const tournamentVetoSettings = pgTable("val_tournament_veto_settings", {
    tournamentId: bigint("tournament_id", { mode: "number" }).primaryKey().references(() => tournaments.id, { onDelete: "cascade" }),
    firstMoverMode: text("first_mover_mode").notNull().default("coin_toss"),
    advantageEntrantId: bigint("advantage_entrant_id", { mode: "number" }).references(() => entrants.id, { onDelete: "set null" }),
    predefinedSlot: char("predefined_slot", { length: 1 }).notNull().default("a"), // 'a' | 'b'
    actionTimeoutSeconds: integer("action_timeout_seconds").notNull().default(60),
    // Default pool of every match: explicit maps, or the maps played on `mapPoolPatch` when the list is empty.
    mapPool: text("map_pool").array().notNull().default([]),
    mapPoolPatch: text("map_pool_patch"),
  });

  // Live state of one match's veto. The decisions themselves land in match_vetos as they are taken.
  const matchVetoSessions = pgTable("val_match_veto_sessions", {
    matchId: bigint("match_id", { mode: "number" }).primaryKey().references(() => matches.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("waiting"), // 'waiting' | 'running' | 'done'
    readyA: boolean("ready_a").notNull().default(false),
    readyB: boolean("ready_b").notNull().default(false),
    coinTossWinnerId: bigint("coin_toss_winner_id", { mode: "number" }).references(() => entrants.id),
    firstEntrantId: bigint("first_entrant_id", { mode: "number" }).references(() => entrants.id),
    // Override of the tournament pool for this match, empty = tournament pool.
    mapPool: text("map_pool").array().notNull().default([]),
    stepStartedAt: timestamp("step_started_at", { withTimezone: true }),
    staffNotifiedAt: timestamp("staff_notified_at", { withTimezone: true }),
    // Bumped on every change, the clients poll on it.
    version: integer("version").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });

  return { maps, mapRoundsRaw, mapRoundKillsRaw, mapRoundDamagesRaw, mapRoundAliveStatesRaw, mapRoundPlayerPositionsRaw, mapRoundPlayerLoadoutsRaw, mapPlayerStats, mapTeamRoundSummary, matchVetos, tournamentVetoSettings, matchVetoSessions };
}

export type ValorantOnlyTables = ReturnType<typeof defineValorantTables>;

const val = defineGameTables("val", (): AnyPgColumn => valorantOnly.maps.id);
const lol = defineGameTables("lol") as unknown as GameTables;
const valorantOnly = defineValorantTables(val);

// drizzle-kit only discovers tables exported at module level.
export const valTeams = val.teams;
export const valLiquipediaTeamNames = val.liquipediaTeamNames;
export const valTeamNameHistory = val.teamNameHistory;
export const valPeople = val.people;
export const valLiquipediaPersonNames = val.liquipediaPersonNames;
export const valRosterMemberships = val.rosterMemberships;
export const valOrganizationMemberships = val.organizationMemberships;
export const valProductionCredits = val.productionCredits;
export const valPointTypes = val.pointTypes;
export const valTournaments = val.tournaments;
export const valTournamentComponents = val.tournamentComponents;
export const valStages = val.stages;
export const valStageContainers = val.stageContainers;
export const valEntrants = val.entrants;
export const valEntrantMembers = val.entrantMembers;
export const valGroupEntries = val.groupEntries;
export const valContainerStandingsRules = val.containerStandingsRules;
export const valMatches = val.matches;
export const valMatchSeeds = val.matchSeeds;
export const valBracketEdges = val.bracketEdges;
export const valStageQualifications = val.stageQualifications;
export const valQualificationResults = val.qualificationResults;
export const valPointEntries = val.pointEntries;
export const valNews = val.news;
export const valNewsMessages = val.newsMessages;
export const valNewsRelations = val.newsRelations;
export const valNewsImages = val.newsImages;
export const valChangeRequests = val.changeRequests;
export const valChangeRequestItems = val.changeRequestItems;
export const valChangeRequestMessages = val.changeRequestMessages;
export const valChangeRequestDiscordNotices = val.changeRequestDiscordNotices;
export const valStreamChannels = val.streamChannels;
export const valMatchStreams = val.matchStreams;
export const valVods = val.vods;
export const valMatchPlayerPovs = val.matchPlayerPovs;
export const valPickemStageSettings = val.pickemStageSettings;
export const valPickemGroups = val.pickemGroups;
export const valPickemGroupMembers = val.pickemGroupMembers;
export const valPickemGroupPhasePoints = val.pickemGroupPhasePoints;
export const valPickemMatchPicks = val.pickemMatchPicks;
export const valPickemStandingPicks = val.pickemStandingPicks;
export const valPickemRewards = val.pickemRewards;
export const valMaps = valorantOnly.maps;
export const valMapRoundsRaw = valorantOnly.mapRoundsRaw;
export const valMapRoundKillsRaw = valorantOnly.mapRoundKillsRaw;
export const valMapRoundDamagesRaw = valorantOnly.mapRoundDamagesRaw;
export const valMapRoundAliveStatesRaw = valorantOnly.mapRoundAliveStatesRaw;
export const valMapRoundPlayerPositionsRaw = valorantOnly.mapRoundPlayerPositionsRaw;
export const valMapRoundPlayerLoadoutsRaw = valorantOnly.mapRoundPlayerLoadoutsRaw;
export const valMapPlayerStats = valorantOnly.mapPlayerStats;
export const valMapTeamRoundSummary = valorantOnly.mapTeamRoundSummary;
export const valMatchVetos = valorantOnly.matchVetos;
export const valTournamentVetoSettings = valorantOnly.tournamentVetoSettings;
export const valMatchVetoSessions = valorantOnly.matchVetoSessions;
export const lolTeams = lol.teams;
export const lolLiquipediaTeamNames = lol.liquipediaTeamNames;
export const lolTeamNameHistory = lol.teamNameHistory;
export const lolPeople = lol.people;
export const lolLiquipediaPersonNames = lol.liquipediaPersonNames;
export const lolRosterMemberships = lol.rosterMemberships;
export const lolOrganizationMemberships = lol.organizationMemberships;
export const lolProductionCredits = lol.productionCredits;
export const lolPointTypes = lol.pointTypes;
export const lolTournaments = lol.tournaments;
export const lolTournamentComponents = lol.tournamentComponents;
export const lolStages = lol.stages;
export const lolStageContainers = lol.stageContainers;
export const lolEntrants = lol.entrants;
export const lolEntrantMembers = lol.entrantMembers;
export const lolGroupEntries = lol.groupEntries;
export const lolContainerStandingsRules = lol.containerStandingsRules;
export const lolMatches = lol.matches;
export const lolMatchSeeds = lol.matchSeeds;
export const lolBracketEdges = lol.bracketEdges;
export const lolStageQualifications = lol.stageQualifications;
export const lolQualificationResults = lol.qualificationResults;
export const lolPointEntries = lol.pointEntries;
export const lolNews = lol.news;
export const lolNewsMessages = lol.newsMessages;
export const lolNewsRelations = lol.newsRelations;
export const lolNewsImages = lol.newsImages;
export const lolChangeRequests = lol.changeRequests;
export const lolChangeRequestItems = lol.changeRequestItems;
export const lolChangeRequestMessages = lol.changeRequestMessages;
export const lolChangeRequestDiscordNotices = lol.changeRequestDiscordNotices;
export const lolStreamChannels = lol.streamChannels;
export const lolMatchStreams = lol.matchStreams;
export const lolVods = lol.vods;
export const lolMatchPlayerPovs = lol.matchPlayerPovs;
export const lolPickemStageSettings = lol.pickemStageSettings;
export const lolPickemGroups = lol.pickemGroups;
export const lolPickemGroupMembers = lol.pickemGroupMembers;
export const lolPickemGroupPhasePoints = lol.pickemGroupPhasePoints;
export const lolPickemMatchPicks = lol.pickemMatchPicks;
export const lolPickemStandingPicks = lol.pickemStandingPicks;
export const lolPickemRewards = lol.pickemRewards;

export const valorantTables: GameTables & ValorantOnlyTables = { ...val, ...valorantOnly };
export const lolTables: GameTables = lol;

/** Thrown when a feature only some games have (maps, stats, veto) is used for another game. */
export class GameFeatureUnavailableError extends Error {
  constructor(game: GameSlug) {
    super(`No maps, stats or veto data for ${game}`);
  }
}

/**
 * Valorant only tables (maps, stats, veto). For another game the tables can be destructured but
 * any use of one (a column, a query) throws, so code that skips its maps part for those games
 * keeps working and code that forgets to never reads Valorant rows by mistake.
 */
export function valorantTablesOf(game: GameSlug): typeof valorantTables {
  if (game === "valorant") return valorantTables;
  const unavailableTable = new Proxy({}, { get: () => { throw new GameFeatureUnavailableError(game); } });
  return new Proxy(valorantTables, { get: (_target, name) => (typeof name === "string" ? unavailableTable : undefined) });
}

export function gameTables(game: GameSlug): GameTables {
  return game === "lol" ? lolTables : valorantTables;
}

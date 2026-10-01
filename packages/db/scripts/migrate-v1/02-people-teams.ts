/**
 * GC-Stats — 02-people-teams
 *
 * V1 to V2 migration step: migrates teams and their name history into
 * their V2 tables, tracking legacy id mappings for later migration steps.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { db, v1 } from "./connection";
import { getMappedId, setMappedId, batchInsert } from "./id-map";
import { people, teams, teamNameHistory } from "../../src/schema";
import { convertCountryCode } from "./country-code";
import { convertSocials } from "./social-links";

function parseJson<T>(val: unknown, fallback: T): T {
  if (val == null) return fallback;
  if (typeof val === "object") return val as T;
  try { return JSON.parse(val as string); } catch { return fallback; }
}

export async function migrateTeams() {
  const [rows] = await v1.query<any[]>(
    "SELECT id, name, short_name, country_code, socials, tags, bio, vlr_id, liquipedia_link, is_active, max_permissions FROM teams"
  );
  let created = 0, skipped = 0;
  for (const row of rows) {
    if (await getMappedId("team", row.id)) { skipped++; continue; }
    const [inserted] = await db.insert(teams).values({
      name: row.name,
      shortName: row.short_name,
      countryCode: convertCountryCode(row.country_code),
      socials: convertSocials(parseJson(row.socials, {})),
      bio: row.bio,
      vlrId: row.vlr_id,
      isActive: !!row.is_active,
      maxPermissions: row.max_permissions ? parseJson(row.max_permissions, null) : null,
      tags: row.tags ? parseJson(row.tags, null) : null,
      liquipediaLink: row.liquipedia_link,
    }).returning({ id: teams.id });
    await setMappedId("team", row.id, inserted.id);
    created++;
  }
  console.log(`teams: ${created} created, ${skipped} already migrated`);

  // team_name_history — small table (2 rows), `period` is a daterange in V2
  // vs V1's separate columns (checked live: `name`, `valid_from`, `valid_to`).
  const [historyCols] = await v1.query<any[]>("DESCRIBE team_name_history");
  const colNames = new Set((historyCols as any[]).map((c) => c.Field));
  if (colNames.size > 0) {
    const [historyRows] = await v1.query<any[]>("SELECT * FROM team_name_history");
    let historyCreated = 0;
    for (const row of historyRows as any[]) {
      const teamId = await getMappedId("team", row.team_id);
      if (!teamId) continue;
      if (await getMappedId("team_name_history", row.id)) continue;
      const from = row.valid_from ?? row.from ?? row.started_at ?? row.created_at;
      const to = row.valid_to ?? row.until ?? row.ended_at ?? null;
      const [inserted] = await db.insert(teamNameHistory).values({
        teamId,
        name: row.name,
        period: to ? `[${toDate(from)},${toDate(to)})` : `[${toDate(from)},)`,
        isVisible: row.is_visible === undefined ? true : !!row.is_visible,
      }).returning({ id: teamNameHistory.id });
      await setMappedId("team_name_history", row.id, inserted.id);
      historyCreated++;
    }
    console.log(`team_name_history: ${historyCreated} created`);
  }
}

function toDate(v: unknown): string {
  const d = v instanceof Date ? v : new Date(String(v));
  return d.toISOString().slice(0, 10);
}

// V1 pronouns are a tinyint enum (App\Enums\Pronouns in Laravel); V2 keeps
// the same smallint vocabulary as a plain column (see DATABASES.MD §3.2's
// "role stays free text" reasoning applied here too) — passed through as-is.

export async function migratePeople() {
  const [players] = await v1.query<any[]>(
    `SELECT id, handle, aliases, first_name, last_name, pronouns, country_code, bio, socials,
            discord_id, val_id, esports_val_id, vlr_id, liquipedia_link, is_active
     FROM players`
  );
  // discordId/valId/esportsValId are UNIQUE in V2 — a handful of V1 rows
  // have duplicate/blank values (data quality), which would abort a whole
  // insert chunk. Null out cross-row duplicates before inserting; keep the
  // first occurrence.
  const seenDiscord = new Set<string>(), seenVal = new Set<string>(), seenEsports = new Set<string>();
  const dedupe = (seen: Set<string>, v: string | null) => {
    if (!v) return null;
    if (seen.has(v)) return null;
    seen.add(v);
    return v;
  };

  const { created, skipped } = await batchInsert(
    "player",
    players as any[],
    (row) => row.id,
    (row) => ({
      handle: row.handle,
      aliases: row.aliases ? parseJson(row.aliases, null) : null,
      firstName: row.first_name,
      lastName: row.last_name,
      countryCode: convertCountryCode(row.country_code),
      pronouns: row.pronouns,
      bio: row.bio,
      socials: convertSocials(parseJson(row.socials, {})),
      discordId: dedupe(seenDiscord, row.discord_id),
      valId: dedupe(seenVal, row.val_id),
      esportsValId: dedupe(seenEsports, row.esports_val_id),
      vlrId: row.vlr_id,
      isActive: !!row.is_active,
      liquipediaLink: row.liquipedia_link,
    }),
    (tx, values) => tx.insert(people).values(values as any).returning({ id: people.id }),
  );
  console.log(`people (from players): ${created} created, ${skipped} already migrated`);

  // staff — merged into the same `people` table (see DATABASES.MD §3.2).
  // No `staff.player_id`/`staff.vlr_id` column exists live (checked: neither
  // is in database/migrations/{0109_create_staff_table,0113_add_pronouns_to_staff_table}.php
  // of the V1 repo, and MySQL confirms it at runtime) — the real link between
  // a staff row and a player row who are the same real person is that BOTH
  // tables carry their own nullable-unique `user_id` (0060_add_user_id_to_players_table.php
  // / 0109), pointing at the same V1 account. Matched with a LEFT JOIN on
  // the V1 side so this needs no V2 `users` migration (accounts are
  // deliberately not ported, see 07-news.ts) — a matched row aliases
  // entity_type 'staff' to the already-migrated player's new id instead of
  // creating a second `people` row for the same person.
  const [staffRows] = await v1.query<any[]>(
    `SELECT s.id, s.first_name, s.last_name, s.pronouns, s.country_code, s.bio, s.socials,
            s.liquipedia_link, s.is_active, s.handle, p.id AS linked_player_id
     FROM staff s
     LEFT JOIN players p ON p.user_id = s.user_id AND s.user_id IS NOT NULL`
  );
  let staffCreated = 0, staffAliased = 0, staffSkipped = 0;
  for (const row of staffRows as any[]) {
    if (await getMappedId("staff", row.id)) { staffSkipped++; continue; }
    if (row.linked_player_id) {
      const linkedPersonId = await getMappedId("player", row.linked_player_id);
      if (linkedPersonId) {
        await setMappedId("staff", row.id, linkedPersonId);
        staffAliased++;
        continue;
      }
    }
    const [inserted] = await db.insert(people).values({
      handle: row.handle,
      firstName: row.first_name,
      lastName: row.last_name,
      countryCode: convertCountryCode(row.country_code),
      pronouns: row.pronouns,
      bio: row.bio,
      socials: convertSocials(parseJson(row.socials, {})),
      isActive: !!row.is_active,
      liquipediaLink: row.liquipedia_link,
    }).returning({ id: people.id });
    await setMappedId("staff", row.id, inserted.id);
    staffCreated++;
  }
  console.log(`people (from staff): ${staffCreated} created, ${staffAliased} aliased to existing player, ${staffSkipped} already migrated`);
}

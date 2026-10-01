/**
 * GC-Stats - entities
 *
 * Response shapes shared between the Teams and Players endpoint groups
 * (V1 JSON contract, snake_case).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export type ApiTeam = {
  id: number;
  name: string;
  short_name: string | null;
  country_code: string | null;
  socials: Record<string, unknown>;
  bio: string | null;
  vlr_id: number | null;
  is_active: boolean;
};

type TeamRow = {
  id: number;
  name: string;
  shortName: string | null;
  countryCode: string | null;
  socials: unknown;
  bio: string | null;
  vlrId: number | null;
  isActive: boolean;
};

export function toApiTeam(row: TeamRow): ApiTeam {
  return {
    id: row.id,
    name: row.name,
    short_name: row.shortName,
    country_code: row.countryCode,
    socials: (row.socials as Record<string, unknown>) ?? {},
    bio: row.bio,
    vlr_id: row.vlrId,
    is_active: row.isActive,
  };
}

type JoinedTeamRow = {
  id: number | null;
  name: string | null;
  shortName: string | null;
  countryCode: string | null;
  socials: unknown;
  bio: string | null;
  vlrId: number | null;
  isActive: boolean | null;
};

/** Builds an `ApiTeam` from a nullable LEFT JOIN row (e.g. a match's optional opponent) — `null` when the join matched nothing. */
export function toApiTeamFromJoined(row: JoinedTeamRow | null): ApiTeam | null {
  if (row == null || row.id == null) return null;
  return {
    id: row.id,
    name: row.name ?? "",
    short_name: row.shortName,
    country_code: row.countryCode,
    socials: (row.socials as Record<string, unknown>) ?? {},
    bio: row.bio,
    vlr_id: row.vlrId,
    is_active: row.isActive ?? false,
  };
}

export type ApiPlayer = {
  id: number;
  handle: string;
  first_name: string | null;
  last_name: string | null;
  country_code: string | null;
  bio: string | null;
  socials: Record<string, unknown>;
  vlr_id: number | null;
  is_active: boolean;
};

type PersonRow = {
  id: number;
  handle: string;
  firstName: string | null;
  lastName: string | null;
  countryCode: string | null;
  bio: string | null;
  socials: unknown;
  vlrId: number | null;
  isActive: boolean;
};

export function toApiPlayer(row: PersonRow): ApiPlayer {
  return {
    id: row.id,
    handle: row.handle,
    first_name: row.firstName,
    last_name: row.lastName,
    country_code: row.countryCode,
    bio: row.bio,
    socials: (row.socials as Record<string, unknown>) ?? {},
    vlr_id: row.vlrId,
    is_active: row.isActive,
  };
}

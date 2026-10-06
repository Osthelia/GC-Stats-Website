/**
 * GC-Stats - change-request-fields
 *
 * Editable-field allowlists for the crowdsourced "suggest an edit" flow.
 * Same fields as the /admin edit forms
 * (components/admin/{team,player}-edit-form.tsx), with the single exception
 * of vlrId AND the Riot IDs (valId/esportsValId), both stay admin-only.
 * Every submission goes through change_requests/change_request_items,
 * no field is ever written directly.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { ROSTER_ROLES } from "@/lib/roster-roles";

export type ChangeRequestFieldType = "text" | "textarea" | "url" | "discordId" | "country" | "boolean" | "tags" | "select";

export type ChangeRequestFieldDef = {
  /** Dot path into the entity object, e.g. "socials.twitter". */
  key: string;
  /** Suffix under suggestEdit.field.* for the label. */
  labelKey: string;
  type: ChangeRequestFieldType;
  required?: boolean;
  /** Text/url/country: value length. Tags: per-tag length. Unused for boolean/select. */
  maxLength: number;
  /** Tags only — max number of entries. */
  maxItems?: number;
  /** Select only — the raw values accepted, resolved to labels via suggestEdit.field.<labelKey>Option.<value>. */
  options?: readonly string[];
};

/** "0"|"1"|"2" mirrors people.pronouns (smallint) in admin/player-edit-form.tsx; "" means unset. */
export const PRONOUN_OPTIONS = ["", "0", "1", "2"] as const;

const TEAM_SOCIAL_FIELDS: ChangeRequestFieldDef[] = [
  { key: "socials.twitter", labelKey: "twitter", type: "url", maxLength: 300 },
  { key: "socials.twitch", labelKey: "twitch", type: "url", maxLength: 300 },
  { key: "socials.instagram", labelKey: "instagram", type: "url", maxLength: 300 },
  { key: "socials.youtube", labelKey: "youtube", type: "url", maxLength: 300 },
  { key: "socials.tiktok", labelKey: "tiktok", type: "url", maxLength: 300 },
  { key: "socials.discord", labelKey: "discord", type: "url", maxLength: 300 },
  { key: "socials.website", labelKey: "website", type: "url", maxLength: 300 },
];

// Mirrors PERSON_SOCIAL_KEYS: no "website" for a person, and Discord is a user ID rather than a link.
const PERSON_SOCIAL_FIELDS: ChangeRequestFieldDef[] = TEAM_SOCIAL_FIELDS.filter((f) => f.key !== "socials.website").map((f) =>
  f.key === "socials.discord" ? { ...f, type: "discordId", maxLength: 20 } : f
);

export const TEAM_CHANGE_REQUEST_FIELDS: ChangeRequestFieldDef[] = [
  { key: "name", labelKey: "name", type: "text", required: true, maxLength: 200 },
  { key: "shortName", labelKey: "shortName", type: "text", maxLength: 10 },
  { key: "countryCode", labelKey: "countryCode", type: "country", maxLength: 3 },
  { key: "secondaryCountryCode", labelKey: "secondaryCountryCode", type: "country", maxLength: 3 },
  { key: "bio", labelKey: "bio", type: "textarea", maxLength: 1000 },
  { key: "liquipediaLink", labelKey: "liquipediaLink", type: "url", maxLength: 300 },
  { key: "isActive", labelKey: "isActive", type: "boolean", maxLength: 0 },
  { key: "tags", labelKey: "tags", type: "tags", maxLength: 30, maxItems: 20 },
  ...TEAM_SOCIAL_FIELDS,
];

// Riot ID / Esports Riot ID deliberately excluded — user request ("Les Riot
// ID dégage"): unlike the rest of the admin form, these are normally filled
// by the ingestion pipeline, not typed by hand (see admin-players.ts's own
// comment on the matching fields), and stay admin-only alongside vlrId.
export const PERSON_CHANGE_REQUEST_FIELDS: ChangeRequestFieldDef[] = [
  { key: "handle", labelKey: "handle", type: "text", required: true, maxLength: 100 },
  { key: "firstName", labelKey: "firstName", type: "text", maxLength: 100 },
  { key: "lastName", labelKey: "lastName", type: "text", maxLength: 100 },
  { key: "countryCode", labelKey: "countryCode", type: "country", maxLength: 3 },
  { key: "secondaryCountryCode", labelKey: "secondaryCountryCode", type: "country", maxLength: 3 },
  { key: "pronouns", labelKey: "pronouns", type: "select", options: PRONOUN_OPTIONS, maxLength: 1 },
  { key: "bio", labelKey: "bio", type: "textarea", maxLength: 1000 },
  { key: "liquipediaLink", labelKey: "liquipediaLink", type: "url", maxLength: 300 },
  { key: "isActive", labelKey: "isActive", type: "boolean", maxLength: 0 },
  { key: "aliases", labelKey: "aliases", type: "tags", maxLength: 50, maxItems: 20 },
  ...PERSON_SOCIAL_FIELDS,
];

export { ROSTER_ROLES };

/** One roster_memberships row — team roster panel and player team-history panel are the same table, viewed from either fixed side. */
export type MembershipOperation =
  | { type: "add"; personId: number; teamId: number; role: string; since: string; until: string | null; inactiveSince: string | null }
  | { type: "edit"; membershipId: number; role: string; since: string; until: string | null; inactiveSince: string | null }
  | { type: "delete"; membershipId: number };

/** Own guardrail against spam on a public form — admin has no such cap. */
export const MAX_MEMBERSHIP_ADDITIONS = 6;

export type NameHistoryOperation =
  | { type: "add"; name: string; since: string; until: string | null }
  | { type: "toggle"; id: number; isVisible: boolean }
  | { type: "delete"; id: number };

export type LogoOperation = { type: "edit"; logoId: string; theme: string | null; since: string; until: string | null } | { type: "delete"; logoId: string };

export type ChangeRequestSubjectType = "team" | "person";

export function fieldsForSubject(subjectType: ChangeRequestSubjectType): ChangeRequestFieldDef[] {
  return subjectType === "team" ? TEAM_CHANGE_REQUEST_FIELDS : PERSON_CHANGE_REQUEST_FIELDS;
}

/** Reads a dot-path ("socials.twitter") off a plain object, returning "" when absent. Text-like field types only — boolean/tags/select are read directly by their own initializers. */
export function readFieldValue(entity: Record<string, unknown>, key: string): string {
  const parts = key.split(".");
  let cur: unknown = entity;
  for (const part of parts) {
    if (cur === null || typeof cur !== "object") return "";
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string" ? cur : "";
}

export function readBooleanValue(entity: Record<string, unknown>, key: string): boolean {
  return Boolean(entity[key]);
}

export function readTagsValue(entity: Record<string, unknown>, key: string): string[] {
  const value = entity[key];
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export function readSelectValue(entity: Record<string, unknown>, key: string): string {
  const value = entity[key];
  if (value === null || value === undefined) return "";
  return String(value);
}

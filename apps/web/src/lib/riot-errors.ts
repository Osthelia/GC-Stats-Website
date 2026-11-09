/**
 * GC-Stats - riot-errors
 *
 * The errors of anything that talks to the Riot relay, in terms an admin can act on: why the relay could not answer
 * (`RelayProblemKind`), and the Riot ID errors next to them (`RiotErrorKind`). Safe to import from client components:
 * no relay code here. `relayProblemKind` (lol-relay-client.ts) maps a relay error to a relay problem.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

/** A 503 is either a missing League key or the relay's database, so both share relayLeagueUnavailable. */
export const RELAY_PROBLEM_KINDS = ["relayNotConfigured", "relayUnauthorized", "riotKeyRejected", "relayLeagueUnavailable", "routeUnavailable", "relayUnreachable", "riotUnavailable"] as const;

export type RelayProblemKind = (typeof RELAY_PROBLEM_KINDS)[number];

export function isRelayProblemKind(value: string): value is RelayProblemKind {
  return (RELAY_PROBLEM_KINDS as readonly string[]).includes(value);
}

/** A relay problem or a Riot ID that is malformed or does not exist. */
export type RiotErrorKind = RelayProblemKind | "riotIdInvalid" | "riotIdNotFound";

export function isRiotErrorKind(kind: string): kind is RiotErrorKind {
  return isRelayProblemKind(kind) || kind === "riotIdInvalid" || kind === "riotIdNotFound";
}

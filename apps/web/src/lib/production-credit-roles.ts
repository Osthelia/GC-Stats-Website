/**
 * GC-Stats - production-credit-roles
 *
 * production_credits.role is free text in the database, kept in sync with
 * this app-side constant list so the list can grow without a migration.
 * This is the suggested list surfaced by the <Select>, same pattern as
 * ROSTER_ROLES. "other" is a UI-only sentinel (see
 * components/dashboard/org-production-credits-panel.tsx): picking it
 * reveals a free-text field whose trimmed value becomes the actual stored
 * role, never the literal string "other".
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export const PRODUCTION_CREDIT_ROLES = [
  "caster",
  "analyst",
  "host",
  "observer",
  "organizer",
  "producer",
  "editor",
  "photographer",
  "translator",
  "referee",
  "head_referee",
  "product_lead",
] as const;

export type ProductionCreditRole = (typeof PRODUCTION_CREDIT_ROLES)[number];

export const PRODUCTION_CREDIT_ROLE_OTHER = "other";

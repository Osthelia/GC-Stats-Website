/**
 * GC-Stats - production-credit-validation
 *
 * Server-side field validation for production credit forms: resolves the
 * "other" role sentinel to its free-text value and checks required fields.
 * DB-backed checks stay in the calling server action, not here.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { PRODUCTION_CREDIT_ROLES, PRODUCTION_CREDIT_ROLE_OTHER } from "@/lib/production-credit-roles";

export type ProductionCreditScope = "tournament" | "match" | "map";

export type ProductionCreditTarget = { scope: ProductionCreditScope; id: number };

export const MAX_PRODUCTION_CREDIT_TARGETS = 200;

export type ProductionCreditInput = {
  personId: number | null;
  /** One of PRODUCTION_CREDIT_ROLES, or the "other" sentinel, see roleOther. */
  role: string;
  /** Only read when role === "other"; becomes the actually stored role, trimmed. */
  roleOther: string;
  titleOverride: string;
  /** One credit row is created per target. */
  targets: ProductionCreditTarget[];
};

export type ProductionCreditField = "person" | "role" | "roleOther" | "titleOverride" | "targets";
export type ProductionCreditFieldErrors = Partial<Record<ProductionCreditField, string>>;

export type ValidatedProductionCredit = {
  fieldErrors: ProductionCreditFieldErrors;
  role: string;
  titleOverride: string | null;
};

export type ValidatedRoleAndTitle = {
  fieldErrors: Pick<ProductionCreditFieldErrors, "role" | "roleOther" | "titleOverride">;
  role: string;
  titleOverride: string | null;
};

/** Shared by the full add-credit validation below and updateProductionCredit (actions/dashboard-production-credits.ts), which only ever edits role/titleOverride in place — person and targets are immutable after creation, see that action's comment. */
export function validateRoleAndTitle(role: string, roleOther: string, titleOverride: string): ValidatedRoleAndTitle {
  const fieldErrors: ValidatedRoleAndTitle["fieldErrors"] = {};

  let resolvedRole = role;
  if (role === PRODUCTION_CREDIT_ROLE_OTHER) {
    const trimmed = roleOther.trim();
    if (!trimmed) fieldErrors.roleOther = "required";
    else if (trimmed.length > 100) fieldErrors.roleOther = "tooLong";
    resolvedRole = trimmed;
  } else if (!(PRODUCTION_CREDIT_ROLES as readonly string[]).includes(role)) {
    fieldErrors.role = "invalidRole";
  }

  const trimmedTitle = titleOverride.trim();
  if (trimmedTitle.length > 150) fieldErrors.titleOverride = "tooLong";

  return { fieldErrors, role: resolvedRole, titleOverride: trimmedTitle || null };
}

/** Pure field validation — DB-backed checks (person and target existence) stay in the server action that has a `db` handle. */
export function validateProductionCreditInput(input: ProductionCreditInput): ValidatedProductionCredit {
  const { fieldErrors: roleFieldErrors, role, titleOverride } = validateRoleAndTitle(input.role, input.roleOther, input.titleOverride);
  const fieldErrors: ProductionCreditFieldErrors = { ...roleFieldErrors };

  if (!input.personId) fieldErrors.person = "required";
  if (input.targets.length === 0) fieldErrors.targets = "targetsRequired";
  else if (input.targets.length > MAX_PRODUCTION_CREDIT_TARGETS) fieldErrors.targets = "tooManyTargets";
  else if (input.targets.some((t) => !["tournament", "match", "map"].includes(t.scope) || !Number.isInteger(t.id) || t.id <= 0)) fieldErrors.targets = "invalidTarget";

  return { fieldErrors, role, titleOverride };
}

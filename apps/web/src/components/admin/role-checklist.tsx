/**
 * GC-Stats - role-checklist
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { Checkbox } from "@/components/ui/checkbox";

export type RoleChecklistSelection = { isOwner: boolean; roleIds: number[] };

/**
 * Owner + custom-role checkbox list backing an organization_access grant —
 * owner is exclusive (checking it clears and disables the rest, a non-owner
 * grant can hold several roles at once, permissions = union). Generic UI
 * primitive, shared by admin's OrganizationDashboardAccessPanel and
 * /dashboard's OrgAccessPanel (same exception as PersonPicker/CountrySelect
 * — CLAUDE.md only forbids sharing business components between admin and
 * dashboard, not neutral pickers/inputs like this one).
 */
export function RoleChecklist({
  roles,
  ownerLabel,
  showOwnerOption,
  selection,
  onChange,
  disabled,
}: {
  roles: { id: number; name: string }[];
  ownerLabel: string;
  /** Whether the "Owner" checkbox is offered at all — the caller decides based on who's granting and what the row already is. */
  showOwnerOption: boolean;
  selection: RoleChecklistSelection;
  onChange: (next: RoleChecklistSelection) => void;
  disabled?: boolean;
}) {
  function toggleOwner() {
    onChange({ isOwner: !selection.isOwner, roleIds: [] });
  }

  function toggleRole(id: number) {
    const roleIds = selection.roleIds.includes(id) ? selection.roleIds.filter((r) => r !== id) : [...selection.roleIds, id];
    onChange({ isOwner: false, roleIds });
  }

  return (
    <div className="flex flex-col gap-1.5">
      {showOwnerOption && (
        <label className="flex items-center gap-2 text-sm font-medium">
          <Checkbox checked={selection.isOwner} onCheckedChange={toggleOwner} disabled={disabled} />
          {ownerLabel}
        </label>
      )}
      {roles.map((role) => (
        <label key={role.id} className="flex items-center gap-2 text-sm">
          <Checkbox checked={!selection.isOwner && selection.roleIds.includes(role.id)} onCheckedChange={() => toggleRole(role.id)} disabled={disabled || selection.isOwner} />
          {role.name}
        </label>
      ))}
    </div>
  );
}

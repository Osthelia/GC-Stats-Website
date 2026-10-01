/**
 * GC-Stats — seed-admin-permissions
 *
 * Seeds the `permissions` table from the ALL_PERMISSIONS catalog and
 * attaches them all to the Super Admin role. Idempotent, safe to re-run
 * after adding a new permission to the catalog.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq } from "drizzle-orm";
import { db } from "../src/client";
import { permissions, roles, rolePermissions } from "../src/schema/auth";
import { ALL_PERMISSIONS } from "../src/permissions";

/**
 * Inserts every permission from the ALL_PERMISSIONS catalog (idempotent —
 * safe to re-run after adding a new permission there). Also attaches all of
 * them to the "Super Admin" role so the /admin/roles permission editor
 * reflects reality — purely cosmetic, since isSuperAdmin already bypasses
 * every hasAccess() check regardless of rolePermissions rows.
 */
async function main() {
  const inserted: { id: number; name: string }[] = [];
  for (const name of ALL_PERMISSIONS) {
    const [row] = await db.insert(permissions).values({ name }).onConflictDoNothing().returning();
    const resolved = row ?? (await db.select().from(permissions).where(eq(permissions.name, name)))[0]!;
    inserted.push({ id: resolved.id, name: resolved.name });
  }

  const [superAdmin] = await db.select().from(roles).where(eq(roles.isSuperAdmin, true));
  if (superAdmin) {
    for (const permission of inserted) {
      await db
        .insert(rolePermissions)
        .values({ roleId: superAdmin.id, permissionId: permission.id })
        .onConflictDoNothing();
    }
  }

  console.log(`Seeded ${inserted.length} permissions${superAdmin ? ` and attached them to "${superAdmin.name}"` : ""}.`);
  process.exit(0);
}

main();

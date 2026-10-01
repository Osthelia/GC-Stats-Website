/**
 * GC-Stats — seed-admin-role
 *
 * One-time setup script: creates the Super Admin role if missing, grants
 * it admin.access, and assigns it to a hardcoded admin username.
 * Idempotent via onConflictDoNothing on each insert.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq } from "drizzle-orm";
import { db } from "../src/client";
import { roles, permissions, rolePermissions, userRoles, users } from "../src/schema/auth";

const ADMIN_USERNAME = "lacy";
const ADMIN_ACCESS_PERMISSION = "admin.access";

async function main() {
  const [permission] = await db
    .insert(permissions)
    .values({ name: ADMIN_ACCESS_PERMISSION })
    .onConflictDoNothing()
    .returning();
  const resolvedPermission =
    permission ?? (await db.select().from(permissions).where(eq(permissions.name, ADMIN_ACCESS_PERMISSION)))[0]!;

  const existingRole = await db.select().from(roles).where(eq(roles.name, "Super Admin"));
  const role =
    existingRole[0] ??
    (
      await db
        .insert(roles)
        .values({ name: "Super Admin", scopeType: "global", isSuperAdmin: true })
        .returning()
    )[0]!;

  await db
    .insert(rolePermissions)
    .values({ roleId: role.id, permissionId: resolvedPermission.id })
    .onConflictDoNothing();

  const [user] = await db.select().from(users).where(eq(users.username, ADMIN_USERNAME));
  if (!user) {
    throw new Error(`No user with username "${ADMIN_USERNAME}" found — cannot assign Super Admin role.`);
  }

  await db
    .insert(userRoles)
    .values({ userId: user.id, roleId: role.id, scopeId: null })
    .onConflictDoNothing();

  console.log(`Super Admin role assigned to "${ADMIN_USERNAME}" (${user.id}).`);
  process.exit(0);
}

main();

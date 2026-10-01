/**
 * GC-Stats — tmp-verify-dashboard
 *
 * Throwaway script that creates a temporary Super Admin user for manually
 * verifying the dashboard, printing its credentials and a sample
 * organization to the console.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "../src/client";
import { users, roles, userRoles } from "../src/schema/auth";
import { organizations as orgsTable } from "../src/schema/people";

async function main() {
  const passwordHash = await bcrypt.hash("Temp-Test-1234!", 10);

  const [user] = await db
    .insert(users)
    .values({ username: "tmp-dashboard-check", email: "tmp-dashboard-check@example.invalid", passwordHash, emailVerified: new Date() })
    .returning();
  if (!user) throw new Error("insert failed");

  const [superAdmin] = await db.select().from(roles).where(eq(roles.isSuperAdmin, true));
  if (!superAdmin) throw new Error("No super admin role found");

  await db.insert(userRoles).values({ userId: user.id, roleId: superAdmin.id, scopeId: null });

  const [org] = await db.select({ id: orgsTable.id, name: orgsTable.name }).from(orgsTable).limit(1);

  console.log(JSON.stringify({ userId: user.id, username: user.username, password: "Temp-Test-1234!", sampleOrg: org }));
  process.exit(0);
}

main();

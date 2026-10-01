/**
 * GC-Stats - route
 *
 * GDPR style data export for the signed in user, downloads a JSON file
 * of everything buildAccountExport gathers about their account.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildAccountExport } from "@/lib/account-export";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const data = await buildAccountExport(userId);
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="gc-stats-data-${userId}-${date}.json"`,
    },
  });
}

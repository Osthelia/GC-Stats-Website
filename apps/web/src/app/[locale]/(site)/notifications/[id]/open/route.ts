/**
 * GC-Stats — route
 *
 * Single entry point for opening a notification (bell, list page, email
 * link): validates ownership, marks it read, then redirects to its link.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { notifications } from "@gc-stats/db";
import { auth } from "@/auth";
import { markRead, APP_BASE_URL } from "@/lib/notify";

// Single entry point used by the bell, the list page and the email link —
// read and navigate can never happen apart, mirrors V1's NotificationController::open.
//
// Redirect URLs are built from SITE_URL, never `request.url` — behind the
// prod reverse proxy the Node server sees its own bind address (0.0.0.0),
// so a redirect resolved against `request.url` sent the browser to
// `0.0.0.0:3000` instead of the real public host.
export async function GET(request: Request, { params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const fallback = new URL(`/${locale}/settings/notifications`, APP_BASE_URL);

  const session = await auth();
  const userId = session?.user?.id;
  const notificationId = Number(id);
  if (!userId || !Number.isInteger(notificationId)) {
    return NextResponse.redirect(fallback);
  }

  const [row] = await db.select({ link: notifications.link, userId: notifications.userId }).from(notifications).where(eq(notifications.id, notificationId)).limit(1);
  if (!row || row.userId !== userId) {
    return NextResponse.redirect(fallback);
  }

  await markRead(notificationId, userId);
  return NextResponse.redirect(row.link ? new URL(`/${locale}${row.link}`, APP_BASE_URL) : fallback);
}

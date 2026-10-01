/**
 * GC-Stats - route
 *
 * Returns the current user's unread notification count and recent notifications.
 * Polled by components/notifications/notification-bell.tsx every 30s.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listRecentNotifications, unreadCount } from "@/lib/notify";

const RECENT_LIMIT = 8;

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const [count, recent] = await Promise.all([unreadCount(userId), listRecentNotifications(userId, RECENT_LIMIT)]);
  return NextResponse.json({ unreadCount: count, recent });
}

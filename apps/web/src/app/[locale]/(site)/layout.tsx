/**
 * GC-Stats — layout
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { SessionProvider } from "next-auth/react";
import { getSession } from "@/lib/session";
import { getGlobalAccess, hasAccess, ADMIN_ACCESS_PERMISSION } from "@/lib/rbac";
import { hasDashboardAccess } from "@/lib/dashboard-rbac";
import { listActiveNewsLanguages } from "@/lib/news-languages";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const userId = session?.user?.id;
  const [isAdmin, isDashboard, newsLanguageOptions] = await Promise.all([
    userId ? getGlobalAccess(userId).then((access) => hasAccess(access, ADMIN_ACCESS_PERMISSION)) : false,
    userId ? hasDashboardAccess(userId) : false,
    listActiveNewsLanguages(),
  ]);

  // Seeds useSession() with the session already read above: without it the
  // header's account menu shows a skeleton until a client-side round trip to
  // /api/auth/session resolves after hydration.
  return (
    <SessionProvider session={session}>
      <SiteHeader isAdmin={isAdmin} isDashboard={isDashboard} newsLanguageOptions={newsLanguageOptions} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </SessionProvider>
  );
}

/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getTeamVetoView } from "@/lib/veto/team-view";
import { VetoRoom } from "@/components/veto/veto-room";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "veto" });
  return { title: t("title"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default async function VetoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await getTeamVetoView(token, null);
  if (!view) notFound();
  return <VetoRoom token={token} initial={view} />;
}

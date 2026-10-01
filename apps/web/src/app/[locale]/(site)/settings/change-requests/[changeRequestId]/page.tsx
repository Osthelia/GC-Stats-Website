/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { redirect, Link } from "@/i18n/navigation";
import { getCurrentUserId } from "@/lib/session";
import { getMyChangeRequestDetail } from "@/lib/settings-change-requests";
import { markChangeRequestNotificationsRead } from "@/lib/notify";
import { listChangeRequestMessages } from "@/lib/change-request-messages";
import { ChangeRequestItemsReadonly } from "@/components/settings/change-request-items-readonly";
import { ChangeRequestMessageThread } from "@/components/settings/change-request-message-thread";
import { WithdrawChangeRequestButton } from "@/components/settings/withdraw-change-request-button";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; changeRequestId: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "accountSettings.changeRequests" });
  return { title: t("title") };
}

export default async function MyChangeRequestDetailPage({ params }: { params: Promise<{ locale: string; changeRequestId: string }> }) {
  const { locale, changeRequestId } = await params;
  setRequestLocale(locale as AppLocale);
  const id = Number.parseInt(changeRequestId, 10);
  if (!Number.isFinite(id)) notFound();

  const userId = await getCurrentUserId();
  if (!userId) {
    redirect({ href: "/login", locale: locale as AppLocale });
    return null;
  }

  const detail = await getMyChangeRequestDetail(userId, id);
  if (!detail) notFound();

  await markChangeRequestNotificationsRead(userId, id);

  const messages = await listChangeRequestMessages(id);
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "accountSettings.changeRequests" });

  return (
    <div className="mx-auto max-w-[900px] px-6 pt-16 pb-28">
      <Link href="/settings/change-requests" className="text-[13px] text-neutral-500 hover:text-neutral-200">
        {t("detail.backToList")}
      </Link>

      <div className="mt-2 mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-[24px] font-bold tracking-tight text-neutral-50">{detail.subjectLabel ?? `#${detail.subjectId}`}</h1>
          <p className="text-[13px] text-neutral-500">{t(`status.${detail.status}`)}</p>
        </div>
        {detail.status === "pending" && <WithdrawChangeRequestButton changeRequestId={detail.id} />}
      </div>

      {detail.reason && (
        <p className="mb-6 rounded-xl border border-neutral-800 bg-[var(--gcs-surface)] p-4 text-[13.5px] leading-[1.6] text-neutral-300">{detail.reason}</p>
      )}

      <ChangeRequestItemsReadonly items={detail.items} />

      <div className="mt-8 border-t border-neutral-800 pt-6">
        <ChangeRequestMessageThread changeRequestId={detail.id} messages={messages} canPost={detail.status === "pending"} currentUserId={userId} />
      </div>
    </div>
  );
}

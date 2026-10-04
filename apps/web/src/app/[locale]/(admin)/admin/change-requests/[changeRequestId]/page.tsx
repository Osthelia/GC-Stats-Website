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
import { PERMISSIONS } from "@gc-stats/db";
import { Link } from "@/i18n/navigation";
import { getAdminChangeRequestDetail } from "@/lib/admin-change-requests";
import { listChangeRequestMessages } from "@/lib/change-request-messages";
import { requireAdminPermission, hasAccess } from "@/lib/rbac";
import { ChangeRequestDetailPanel } from "@/components/admin/change-request-detail-panel";
import type { AppLocale } from "@/i18n/routing";
import { FormattedDate } from "@/components/formatted-date";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.changeRequests" });
  return { title: t("title") };
}

export default async function AdminChangeRequestDetailPage({ params }: { params: Promise<{ locale: string; changeRequestId: string }> }) {
  const { locale, changeRequestId } = await params;
  const id = Number.parseInt(changeRequestId, 10);
  if (!Number.isFinite(id)) notFound();

  const access = await requireAdminPermission(locale as AppLocale, PERMISSIONS.changeRequestsView);
  const t = await getTranslations({ locale, namespace: "admin.changeRequests" });

  const detail = await getAdminChangeRequestDetail(id);
  if (!detail) notFound();

  const messages = await listChangeRequestMessages(id);
  const canManage = hasAccess(access, PERMISSIONS.changeRequestsManage);
  const subjectHref = detail.subjectType === "team" ? `/admin/teams/${detail.subjectId}` : `/admin/players/${detail.subjectId}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/change-requests" className="text-sm text-muted-foreground hover:text-foreground">
          {t("detail.backToList")}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">
          <Link href={subjectHref} className="hover:underline">
            {detail.subjectLabel ?? t("unknownSubject", { id: detail.subjectId })}
          </Link>
        </h1>
        <p className="text-sm text-muted-foreground">
          {detail.requestedByUsername ? t("detail.requestedBy", { username: detail.requestedByUsername }) : t("detail.requestedByUnknown")}
          {" · "}
          <FormattedDate date={detail.createdAt} mode="datetime" />
        </p>
        <p className="mt-2 text-sm">
          <span className="text-muted-foreground">{t("detail.reason")}: </span>
          {detail.reason || <span className="text-muted-foreground">{t("detail.noReason")}</span>}
        </p>
      </div>

      <ChangeRequestDetailPanel detail={detail} canManage={canManage} messages={messages} />
    </div>
  );
}

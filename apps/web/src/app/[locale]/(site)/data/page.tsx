/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { LegalPageHeader, LegalIntro, SectionCard, SectionText, InfoBar, icons } from "@/components/legal/ui";
import { DataGroupHeading, HostingCard, PersonalDataCard, PrincipleCard } from "@/components/data/personal-data";
import { Link } from "@/i18n/navigation";
import { ACTIVITY_LOG_IP_RETENTION_DAYS } from "@/lib/scheduled-jobs/jobs/prune-activity-log-ips";
import { staticTitleMetadata } from "@/lib/page-metadata";

export const generateMetadata = staticTitleMetadata("dataPage.title");

const PRINCIPLES: { key: "noSale" | "minimal" | "switzerland"; icon: ReactNode }[] = [
  { key: "noSale", icon: icons.ban },
  { key: "minimal", icon: icons.shield },
  { key: "switzerland", icon: icons.globe },
];

const HOSTS: { key: "infomaniak" | "backups" | "cdn"; icon: ReactNode }[] = [
  { key: "infomaniak", icon: icons.server },
  { key: "backups", icon: icons.database },
  { key: "cdn", icon: icons.globe },
];

type Category = { key: string; icon: ReactNode; groups: string[] };

const PRIVATE_CATEGORIES: Category[] = [
  { key: "account", icon: icons.id, groups: ["profile", "security", "linked", "developers"] },
  { key: "protection", icon: icons.shield, groups: ["loginLog", "accessLogs"] },
  { key: "moderation", icon: icons.gavel, groups: ["requests", "moderation"] },
];

const PUBLIC_CATEGORIES: Category[] = [
  { key: "players", icon: icons.users, groups: ["identity", "career", "hidden"] },
  { key: "matchStats", icon: icons.chart, groups: ["stats"] },
  { key: "community", icon: icons.heart, groups: ["content"] },
];

const DETAILS = ["source", "visibility", "retention"] as const;

export default function DataPage() {
  const t = useTranslations("dataPage");

  function renderCategory({ key, icon, groups }: Category) {
    return (
      <PersonalDataCard
        key={key}
        icon={icon}
        title={t(`categories.${key}.title` as never)}
        groups={groups.map((group) => ({
          label: t(`categories.${key}.groups.${group}.label` as never),
          items: t.raw(`categories.${key}.groups.${group}.items` as never) as string[],
        }))}
        details={DETAILS.map((detail) => ({
          label: t(`labels.${detail}`),
          value: t(`categories.${key}.${detail}` as "categories.protection.retention", { days: ACTIVITY_LOG_IP_RETENTION_DAYS }),
        }))}
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-16">
      <LegalPageHeader title={t("title")} />
      <LegalIntro>{t("subtitle")}</LegalIntro>

      <SectionCard icon={icons.heart} title={t("policy.title")}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {PRINCIPLES.map(({ key, icon }) => (
            <PrincipleCard key={key} icon={icon} title={t(`policy.${key}.title`)}>
              {t(`policy.${key}.text`)}
            </PrincipleCard>
          ))}
        </div>
      </SectionCard>

      <SectionCard icon={icons.server} title={t("storage.title")}>
        <SectionText>{t("storage.why")}</SectionText>
        <SectionText>{t("storage.providers")}</SectionText>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {HOSTS.map(({ key, icon }) => (
            <HostingCard key={key} icon={icon} name={t(`storage.${key}.name`)} location={t(`storage.${key}.location`)}>
              {t(`storage.${key}.body`)}
            </HostingCard>
          ))}
        </div>
      </SectionCard>

      <DataGroupHeading title={t("private.title")} badge={t("private.badge")} isPublic={false}>
        {t("private.intro")}
      </DataGroupHeading>
      {PRIVATE_CATEGORIES.map(renderCategory)}

      <DataGroupHeading title={t("public.title")} badge={t("public.badge")} isPublic>
        {t("public.intro")}
      </DataGroupHeading>
      {PUBLIC_CATEGORIES.map(renderCategory)}

      <InfoBar>
        {t("rights")}{" "}
        <Link href="/privacy" className="font-medium text-neutral-300 underline decoration-[#e4ae22] decoration-2 underline-offset-2 transition hover:text-neutral-50 active:opacity-70">
          {t("privacyLink")}
        </Link>
      </InfoBar>
    </div>
  );
}

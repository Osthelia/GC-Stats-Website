/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { eq } from "drizzle-orm";
import { adminDb } from "@gc-stats/db/client";
import { users } from "@gc-stats/db";
import { auth } from "@/auth";
import { Link } from "@/i18n/navigation";
import { FormattedDate } from "@/components/formatted-date";
import { AcceptRulesButton } from "@/components/forum/accept-rules-button";
import { staticTitleMetadata } from "@/lib/page-metadata";

export const generateMetadata = staticTitleMetadata("forum.rules.title");

const RULE_KEYS = ["respect", "harassment", "spam", "content", "enforcement", "automod"] as const;

export default async function ForumRulesPage() {
  const t = await getTranslations("forum.rules");
  const session = await auth();

  const acceptedAt = session?.user?.id
    ? (await adminDb.select({ forumRulesAcceptedAt: users.forumRulesAcceptedAt }).from(users).where(eq(users.id, session.user.id)).limit(1))[0]?.forumRulesAcceptedAt ?? null
    : null;

  return (
    <div className="mx-auto max-w-[720px] px-6 py-10">
      <h1 className="mb-1 text-2xl font-black text-neutral-50">{t("title")}</h1>
      <p className="mb-6 text-sm text-[var(--gcs-text-tertiary)]">{t("intro")}</p>

      <div className="mb-8 flex flex-col gap-4">
        {RULE_KEYS.map((key) => (
          <div key={key} className="rounded-2xl border border-neutral-800 bg-[var(--gcs-surface)] p-5">
            <h2 className="mb-1.5 text-[15px] font-bold text-neutral-50">{t(`items.${key}.title`)}</h2>
            <p className="text-[14px] leading-relaxed text-neutral-400">{t(`items.${key}.body`)}</p>
          </div>
        ))}
      </div>

      {!session?.user?.id ? (
        <div className="rounded-2xl border border-neutral-800 bg-[var(--gcs-surface)] p-6 text-center">
          <p className="mb-3 text-[14.5px] text-neutral-300">{t("loginToAccept")}</p>
          <Link href="/login" className="inline-block rounded-[9px] bg-[#e4ae22] px-5 py-2.5 text-[14px] font-semibold text-[#0e0e0e] transition-colors hover:bg-[#c9981d]">
            {t("login")}
          </Link>
        </div>
      ) : acceptedAt ? (
        <p className="text-[13.5px] text-[#7cc48a]">
          {t("alreadyAccepted")} <FormattedDate date={acceptedAt} mode="datetime" />
        </p>
      ) : (
        <AcceptRulesButton />
      )}
    </div>
  );
}

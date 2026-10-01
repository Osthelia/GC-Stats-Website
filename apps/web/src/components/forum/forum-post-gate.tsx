/**
 * GC-Stats - forum-post-gate
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export type ForumPostStatus = "guest" | "blocked" | "muted" | "rulesNotAccepted" | "ok";

/** Shared not-allowed-to-post notice for the create-thread page and thread reply section (same guard order as lib/forum-guards.ts::assertCanPostToForum). */
export async function ForumPostGate({ status, children }: { status: ForumPostStatus; children: ReactNode }) {
  if (status === "ok") return <>{children}</>;

  const t = await getTranslations("forum.gate");

  if (status === "guest") {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-[var(--gcs-surface)] p-6 text-center">
        <p className="mb-3 text-[14.5px] text-neutral-300">{t("guest")}</p>
        <Link href="/login" className="inline-block rounded-[9px] bg-[#e4ae22] px-5 py-2.5 text-[14px] font-semibold text-[#0e0e0e] transition-colors hover:bg-[#c9981d]">
          {t("guestLogin")}
        </Link>
      </div>
    );
  }

  if (status === "blocked") {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-[var(--gcs-surface)] p-6 text-center">
        <p className="text-[14.5px] text-[#e08585]">{t("blocked")}</p>
      </div>
    );
  }

  if (status === "muted") {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-[var(--gcs-surface)] p-6 text-center">
        <p className="text-[14.5px] text-[#e08585]">{t("muted")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-[var(--gcs-surface)] p-6 text-center">
      <p className="mb-3 text-[14.5px] text-neutral-300">{t("rulesNotAccepted")}</p>
      <Link href="/forum/rules" className="inline-block rounded-[9px] bg-[#e4ae22] px-5 py-2.5 text-[14px] font-semibold text-[#0e0e0e] transition-colors hover:bg-[#c9981d]">
        {t("rulesNotAcceptedCta")}
      </Link>
    </div>
  );
}

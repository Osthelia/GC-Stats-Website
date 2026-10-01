/**
 * GC-Stats - user-badges
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ThemedLogoImage } from "@/components/site/themed-logo-image";
import type { UserFanTeam } from "@/lib/user-profile-data";
import { slugify } from "@/lib/entity-id";

/** Pronoun + fan team pills, shared between the user profile header and the forum. */
export async function UserBadges({ pronouns, fanTeam, size = "md" }: { pronouns: number | null; fanTeam: UserFanTeam | null; size?: "sm" | "md" }) {
  if (pronouns === null && !fanTeam) return null;

  const t = await getTranslations("userPage");
  const pronounLabel = pronouns !== null ? t(`pronounsOption.${pronouns}`) : null;
  const pill = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]";
  const logoSize = size === "sm" ? 12 : 14;

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {pronounLabel && <span className={`rounded-md border border-neutral-800 bg-white/5 ${pill} font-bold tracking-[0.04em] text-neutral-400 uppercase`}>{pronounLabel}</span>}
      {fanTeam && (
        <Link
          href={`/team/${fanTeam.id}/${slugify(fanTeam.name)}`}
          className={`flex items-center gap-1.5 rounded-md border border-[#5c4c22] bg-[#e4ae22]/10 ${pill} font-bold tracking-[0.04em] text-[#e4ae22] transition-colors hover:bg-[#e4ae22]/20`}
        >
          {(fanTeam.logoUrl || fanTeam.logoUrlLight) && (
            <ThemedLogoImage
              dark={fanTeam.logoUrl ?? fanTeam.logoUrlLight!}
              light={fanTeam.logoUrlLight ?? fanTeam.logoUrl!}
              alt=""
              width={logoSize}
              height={logoSize}
              className="flex-none object-contain"
            />
          )}
          {fanTeam.tag || t("supports", { tag: fanTeam.displayName })}
        </Link>
      )}
    </span>
  );
}

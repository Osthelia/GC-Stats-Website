/**
 * GC-Stats - organization-vods-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import type { OrganizationVod } from "@/lib/organization-page-data";

export async function OrganizationVodsPanel({ vods }: { vods: OrganizationVod[] }) {
  const t = await getTranslations("organizationPage");

  return (
    <div>
      <h2 className="mb-3 text-[13px] font-extrabold tracking-[0.13em] text-neutral-50 uppercase">{t("vods")}</h2>

      {vods.length === 0 ? (
        <p className="text-sm text-neutral-500">{t("noVods")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {vods.map((v) => (
            <a
              key={v.id}
              href={v.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-[var(--gcs-surface-2)] p-3 transition-colors hover:border-neutral-700"
            >
              <span className="min-w-0 truncate text-[13px] font-semibold text-[var(--gcs-text)]">{v.matchLabel}</span>
              <span className="flex-none font-mono text-[10px] tracking-widest text-neutral-500 uppercase">{v.languageCode}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

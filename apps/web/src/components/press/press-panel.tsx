/**
 * GC-Stats - press-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { Link } from "@/i18n/navigation";
import { FormattedDate } from "@/components/formatted-date";

export type PressItem = {
  title: string;
  slug: string;
  publisher: string;
  publishedAt: Date | null;
  lang: string;
};

/** "Press" card — shared by any entity's overview tab (team, player, ...). */
export function PressPanel({
  items,
  title,
  emptyLabel,
  langNote,
}: {
  items: PressItem[];
  title: string;
  emptyLabel: string;
  langNote: string;
}) {
  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-[13px] font-extrabold tracking-[0.13em] text-neutral-50 uppercase">{title}</h2>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">{emptyLabel}</p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {items.map((item, i) => (
              <Link
                key={i}
                href={`/news/${item.slug}`}
                className="block overflow-hidden rounded-xl border border-neutral-800 bg-[var(--gcs-surface-3)] transition-colors hover:border-neutral-700"
              >
                <div className="flex flex-col gap-2 rounded-r-xl border-l-2 px-3.5 py-3" style={{ borderColor: "#e4ae22" }}>
                  <span className="text-[14.5px] font-bold leading-snug text-[var(--gcs-text)]">{item.title}</span>
                  <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.05em] text-neutral-500">
                    <span className="flex h-4 w-4 flex-none items-center justify-center rounded-sm bg-white/[0.08] text-[9px] font-bold text-neutral-300">
                      {item.publisher.charAt(0).toUpperCase()}
                    </span>
                    {item.publisher.toUpperCase()}
                    {item.publishedAt && (
                      <>
                        {" · "}
                        <FormattedDate date={item.publishedAt} mode="date" />
                      </>
                    )}
                    <span className="rounded border border-neutral-800 px-1 py-px tracking-[0.1em] text-neutral-500">{item.lang.toUpperCase()}</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-neutral-600">{langNote}</p>
        </>
      )}
    </div>
  );
}

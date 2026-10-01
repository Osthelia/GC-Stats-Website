/**
 * GC-Stats - date-range-filter
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getLocale } from "next-intl/server";
import { Link, getPathname } from "@/i18n/navigation";

/** GET form with a from/to date pair, other active params carried as hidden inputs. Values are validated by the page (YYYY-MM-DD). */
export async function DateRangeFilter({
  path,
  hidden,
  fromName,
  toName,
  from,
  to,
  fromLabel,
  toLabel,
  applyLabel,
  clearLabel,
  clearHref,
}: {
  path: string;
  hidden: Record<string, string | null | undefined>;
  fromName: string;
  toName: string;
  from: string;
  to: string;
  fromLabel: string;
  toLabel: string;
  applyLabel: string;
  clearLabel: string;
  clearHref: string;
}) {
  const locale = await getLocale();
  const action = getPathname({ href: path, locale });

  return (
    <form
      method="GET"
      action={action}
      className="flex flex-wrap items-center gap-2"
    >
      {Object.entries(hidden).map(([name, value]) =>
        value ? (
          <input key={name} type="hidden" name={name} value={value} />
        ) : null,
      )}
      <div className="flex items-center gap-1.5 overflow-hidden rounded-lg border border-neutral-800 bg-[var(--gcs-surface-2)] px-2.5 py-1">
        <input
          type="date"
          name={fromName}
          defaultValue={from}
          aria-label={fromLabel}
          className="w-[132px] bg-transparent text-xs text-neutral-300 [color-scheme:dark] focus:outline-none site-light:[color-scheme:light]"
        />
        <span className="text-neutral-700">-</span>
        <input
          type="date"
          name={toName}
          defaultValue={to}
          aria-label={toLabel}
          className="w-[132px] bg-transparent text-xs text-neutral-300 [color-scheme:dark] focus:outline-none site-light:[color-scheme:light]"
        />
      </div>
      <button
        type="submit"
        className="rounded-lg border border-neutral-800 bg-[var(--gcs-surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--gcs-text-dim)] transition-colors hover:border-[#e4ae22]/40 hover:text-[#e4ae22] active:scale-[0.97]"
      >
        {applyLabel}
      </button>
      {(from || to) && (
        <Link
          href={clearHref}
          className="text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-300 active:opacity-70"
        >
          {clearLabel}
        </Link>
      )}
    </form>
  );
}

/**
 * GC-Stats - news-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { HomeNewsItem } from "@/lib/home-data";
import { ThemedLogoImage } from "@/components/site/themed-logo-image";

// No generic "organization" placeholder image asset exists (unlike
// teams/tournaments' default logos) — an initial letter mirrors the same
// idiom PressPanel already uses for a missing publisher logo.
function PublisherLogo({ src, srcLight, alt, size = 26 }: { src: string | null; srcLight: string | null; alt: string; size?: number }) {
  if (!src && !srcLight) {
    return (
      <span
        className="flex flex-none items-center justify-center overflow-hidden rounded-lg bg-white/[0.08] font-bold text-neutral-300"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {alt.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <span className="flex flex-none items-center justify-center overflow-hidden rounded-lg" style={{ width: size, height: size }}>
      <ThemedLogoImage dark={src ?? srcLight!} light={srcLight ?? src!} alt={alt} width={size} height={size} className="h-full w-full object-contain" />
    </span>
  );
}

export function NewsPanel({ featured, items }: { featured: HomeNewsItem | null; items: HomeNewsItem[] }) {
  const t = useTranslations("home");

  return (
    <div>
      <div className="mb-3.5 flex items-baseline gap-3">
        <h2 className="text-[17px] font-bold tracking-tight text-neutral-50">{t("latestNewsHeading")}</h2>
        <Link href="/news" className="ml-auto text-[13.5px] font-medium text-neutral-500 hover:text-[#e4ae22]">
          {t("all")}
        </Link>
      </div>

      {featured && (
        <Link
          href={`/news/${featured.slug}`}
          className="mb-1.5 block rounded-2xl border border-neutral-800 bg-[var(--gcs-surface)] p-4 transition-colors hover:border-[#3a3222] hover:bg-[var(--gcs-hover)]"
        >
          <div className="mb-2.5 flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#e4ae22" className="flex-none">
              <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2z" />
            </svg>
            <span className="text-xs font-semibold tracking-tight text-[#e4ae22]">{t("featured")}</span>
          </div>
          <div className="text-[17px] font-bold leading-snug tracking-tight text-neutral-50">{featured.title}</div>
          {featured.excerpt && <div className="mt-1.5 text-[13.5px] leading-relaxed text-neutral-400">{featured.excerpt}</div>}
          <div className="mt-3.5 flex items-center gap-2">
            <PublisherLogo src={featured.publisherLogoUrl} srcLight={featured.publisherLogoUrlLight} alt={featured.publisher} size={24} />
            <span className="text-[13px] font-medium text-neutral-300">{featured.publisher}</span>
            <span className="h-[3px] w-[3px] flex-none rounded-full bg-neutral-700" />
            <span className="text-xs text-neutral-500">{featured.date}</span>
          </div>
        </Link>
      )}

      <div className="flex flex-col">
        {items.map((n) => (
          <Link key={n.slug} href={`/news/${n.slug}`} className="flex gap-2.5 border-t border-neutral-900 py-3.5 transition-transform hover:translate-x-1 hover:text-[#e4ae22]">
            <PublisherLogo src={n.publisherLogoUrl} srcLight={n.publisherLogoUrlLight} alt={n.publisher} />
            <div className="min-w-0">
              <div className="text-[14.5px] font-semibold leading-snug tracking-tight">{n.title}</div>
              <div className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-neutral-500">
                {n.publisher} · {n.date}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

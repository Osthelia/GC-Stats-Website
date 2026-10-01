/**
 * GC-Stats - news-article-card
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { FormattedDate } from "@/components/formatted-date";
import { ThemedLogoImage } from "@/components/site/themed-logo-image";
import type { PublicNewsListItem } from "@/lib/news-page-data";

function PublisherLogo({ src, srcLight, alt }: { src: string | null; srcLight: string | null; alt: string }) {
  if (!src && !srcLight) {
    return (
      <span className="flex size-7 flex-none items-center justify-center rounded-md bg-white/[0.08] text-[11px] font-bold text-neutral-300">{alt.charAt(0).toUpperCase()}</span>
    );
  }
  return (
    <span className="flex size-7 flex-none items-center justify-center overflow-hidden rounded-md">
      <ThemedLogoImage dark={src ?? srcLight!} light={srcLight ?? src!} alt="" width={28} height={28} className="h-full w-full object-contain" />
    </span>
  );
}

/** Shared article card — grid layout used by `/news`, a user's news tab and an organization's news tab. */
export function NewsArticleCard({ item, languageName, featuredLabel }: { item: PublicNewsListItem; languageName: string; featuredLabel: string }) {
  return (
    <Link
      href={`/news/${item.slug}`}
      className="flex flex-col overflow-hidden rounded-xl border border-neutral-800/70 bg-[var(--gcs-surface-3)] transition-all hover:border-neutral-700 hover:bg-[var(--gcs-hover)]"
    >
      {item.imageCover && (
        <div className="relative aspect-video w-full bg-black/40">
          <Image src={item.imageCover} alt="" fill sizes="360px" className="object-cover" unoptimized />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        {item.isFeatured && <span className="w-fit text-[10px] font-black tracking-widest text-[#e4ae22] uppercase">{featuredLabel}</span>}
        <h2 className="text-[15px] font-bold tracking-tight text-neutral-50">{item.title}</h2>
        {item.excerpt && <p className="line-clamp-2 text-[13px] text-neutral-400">{item.excerpt}</p>}
        <div className="mt-auto flex items-center gap-2 border-t border-neutral-800/70 pt-3 text-[11.5px] text-neutral-500">
          <PublisherLogo src={item.publisherLogoUrl} srcLight={item.publisherLogoUrlLight} alt={item.publisherName} />
          <span className="truncate font-medium text-neutral-300">{item.publisherName}</span>
          <span className="rounded border border-neutral-800 px-1.5 py-px text-[9px] font-semibold tracking-[0.05em] uppercase">{languageName}</span>
          {item.publishedAt && (
            <span className="ml-auto flex-none">
              <FormattedDate date={item.publishedAt} mode="date" />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

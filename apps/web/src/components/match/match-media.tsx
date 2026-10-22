/**
 * GC-Stats - match-media
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getLocale, getTranslations } from "next-intl/server";
import { TwitchIcon, YoutubeIcon, STREAM_PLATFORM_ICONS, WebsiteIcon } from "@/components/icons/brand-icons";
import { languageFlagClass } from "@/lib/countries";
import type { MatchStream, MatchVod, MatchPlayerPov } from "@/lib/match-page-data";

// Renders nothing when the language has no flag sprite, so no empty box is left in the link.
function LanguageFlag({ code }: { code: string }) {
  const flagClass = languageFlagClass(code);
  if (!flagClass) return null;
  return <span className={`fi ${flagClass} shrink-0 rounded-[2px]`} title={code} />;
}

function MediaDivider({ label }: { label: string }) {
  return (
    <div className="mt-6 mb-3 flex items-center justify-center gap-3">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-neutral-800" />
      <span className="font-mono text-[9px] font-black tracking-[0.5em] text-neutral-600 uppercase">{label}</span>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-neutral-800" />
    </div>
  );
}

const linkClassName =
  "flex items-center gap-2 rounded-lg border border-neutral-800 bg-white/[0.02] px-3 py-2 text-[12px] font-semibold text-neutral-200 transition-colors hover:border-neutral-700 hover:bg-white/[0.05]";

// Base language of a stored code, e.g. "en-US" -> "en" (char columns may be space padded).
function baseLanguage(code: string): string {
  return code.trim().toLowerCase().split(/[-_]/)[0] ?? "";
}

// English and the site language, or every stream when none matches.
function filterStreamsByLocale(streams: MatchStream[], locale: string): MatchStream[] {
  const accepted = new Set(["en", baseLanguage(locale)]);
  const matching = streams.filter((s) => accepted.has(baseLanguage(s.languageCode)));
  return matching.length > 0 ? matching : streams;
}

export async function MatchMedia({ streams: allStreams, vods, povs, isCompleted }: { streams: MatchStream[]; vods: MatchVod[]; povs: MatchPlayerPov[]; isCompleted: boolean }) {
  const [t, locale] = await Promise.all([getTranslations("matchPage"), getLocale()]);
  const streams = filterStreamsByLocale(allStreams, locale);
  const primaryCount = isCompleted ? vods.length : streams.length;
  if (primaryCount === 0 && povs.length === 0) return null;

  const primaryLabel = isCompleted ? t("vods") : t("streams");

  return (
    <div className="flex flex-col gap-4">
      {primaryCount > 0 && (
        <div>
          <MediaDivider label={primaryLabel} />
          <div className="flex flex-wrap justify-center gap-2">
            {isCompleted
              ? vods.map((v) => (
                  <a key={v.id} href={v.url} target="_blank" rel="noreferrer noopener" className={linkClassName}>
                    <YoutubeIcon className="h-3.5 w-3.5 flex-none text-neutral-400" />
                    {v.mapOrder != null ? t("vodMap", { n: v.mapOrder }) : t("vodFull")}
                    <LanguageFlag code={v.languageCode} />
                  </a>
                ))
              : streams.map((s) => {
                  const Icon = STREAM_PLATFORM_ICONS[s.platform] ?? WebsiteIcon;
                  return (
                    <a key={s.id} href={s.url} target="_blank" rel="noreferrer noopener" className={linkClassName}>
                      <Icon className="h-3.5 w-3.5 flex-none text-neutral-400" />
                      {s.name}
                      {s.type === "watchparty" && <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-widest text-neutral-400 uppercase">{t("watchparty")}</span>}
                      <LanguageFlag code={s.languageCode} />
                    </a>
                  );
                })}
          </div>
        </div>
      )}

      {povs.length > 0 && (
        <div>
          <MediaDivider label={t("povs")} />
          <div className="flex flex-wrap justify-center gap-2">
            {povs.map((p) => (
              <a key={p.id} href={p.url} target="_blank" rel="noreferrer noopener" className={linkClassName}>
                <TwitchIcon className="h-3.5 w-3.5 flex-none text-neutral-400" />
                {p.title ?? (p.handle ? t("povOf", { name: p.handle }) : p.twitchLogin)}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

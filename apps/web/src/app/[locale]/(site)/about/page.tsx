/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listAboutSections, listAboutProjects, type AboutProjectType } from "@/lib/admin-about";
import { getAboutTeam, type AboutTeamMember } from "@/lib/about-data";
import { ThemedLogoImage } from "@/components/site/themed-logo-image";
import { DiscordIcon, TwitchIcon, XIcon, InstagramIcon, YoutubeIcon, TiktokIcon, WebsiteIcon, SOCIAL_BRAND_COLORS } from "@/components/icons/brand-icons";
import type { AppLocale } from "@/i18n/routing";
import { staticTitleMetadata } from "@/lib/page-metadata";

export const generateMetadata = staticTitleMetadata("aboutPage.title");

const SOCIAL_ICONS: Record<string, (props: { className?: string }) => React.ReactNode> = {
  twitter: XIcon,
  x: XIcon,
  twitch: TwitchIcon,
  instagram: InstagramIcon,
  youtube: YoutubeIcon,
  tiktok: TiktokIcon,
  discord: DiscordIcon,
  website: WebsiteIcon,
};

const PROJECT_TYPE_STYLE: Record<AboutProjectType, { icon: (props: { className?: string }) => React.ReactNode; color: string }> = {
  Website: { icon: WebsiteIcon, color: "#e4ae22" },
  API: { icon: CodeIcon, color: "#F54927" },
  DiscordBot: { icon: DiscordIcon, color: "#5865F2" },
};

function CodeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13 5l-2 14" />
    </svg>
  );
}

function localized(value: Record<string, string> | null | undefined, locale: string): string {
  if (!value) return "";
  return value[locale] ?? value.en ?? Object.values(value)[0] ?? "";
}

type TeamCategory = AboutTeamMember["category"];

/** Members already come sorted by category order then member order (getAboutTeam) — grouping here just needs to preserve that order. */
function groupTeamByCategory(team: AboutTeamMember[]): [TeamCategory, AboutTeamMember[]][] {
  const groups: [TeamCategory, AboutTeamMember[]][] = [];
  for (const member of team) {
    const last = groups.at(-1);
    if (last && last[0]?.key === member.category?.key) {
      last[1].push(member);
    } else {
      groups.push([member.category, [member]]);
    }
  }
  return groups;
}

export default async function AboutPage() {
  const [t, locale, sections, projects, team] = await Promise.all([
    getTranslations("aboutPage"),
    getLocale(),
    listAboutSections(),
    listAboutProjects(),
    getAboutTeam(),
  ]);

  const activeProjects = projects.filter((p) => p.isActive);

  return (
    <div className="mx-auto max-w-5xl space-y-12 px-6 py-16">
      <div className="border-b border-neutral-800 pb-6 text-center">
        <h1 className="text-3xl font-black tracking-tight text-neutral-50 uppercase sm:text-4xl">{t("title")}</h1>
      </div>

      {sections.map((section) => {
        const title = localized(section.title, locale as AppLocale);
        const content = localized(section.content, locale as AppLocale);
        if (!title && !content) return null;
        return (
          <section key={section.id} className="space-y-3">
            <div className="border-b border-neutral-800 pb-2">
              <h2 className="text-xs font-bold tracking-[0.2em] text-neutral-200 uppercase">{title}</h2>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-line text-neutral-400">{content}</p>
          </section>
        );
      })}

      {team.length > 0 && (
        <section className="space-y-8">
          <div className="border-b border-neutral-800 pb-2">
            <h2 className="text-xs font-bold tracking-[0.2em] text-neutral-200 uppercase">{t("team.title")}</h2>
          </div>
          {groupTeamByCategory(team).map(([category, members]) => (
            <div key={category?.key ?? "__uncategorized__"} className="space-y-5">
              {category && (
                <h3 className="text-center text-[11px] font-bold tracking-[0.2em] text-neutral-500 uppercase">{localized(category.label, locale as AppLocale)}</h3>
              )}
              <div className="flex flex-wrap justify-center gap-6">
                {members.map((member) => {
                  const displayName = member.name || member.username;
                  const roleLabel = member.displayRole ? localized(member.displayRole, locale as AppLocale) : member.roleNames.join(", ");
                  const links = Object.entries(member.socials).filter(([key, url]) => !!url && SOCIAL_ICONS[key]);
                  return (
                    <div
                      key={member.id}
                      className="group relative flex w-60 flex-col items-center overflow-hidden rounded-sm border border-neutral-900 bg-[#050505] p-7 text-center shadow-lg transition-all duration-300 hover:bg-[var(--gcs-surface)]"
                    >
                      <div className="absolute inset-x-0 top-0 h-[2px] bg-[#e4ae22]" />

                      <Link href={`/user/${member.username}`} className="absolute inset-0" aria-label={displayName} />

                      <div className="relative mb-4 flex h-20 w-20 flex-none items-center justify-center overflow-hidden rounded-full border border-neutral-800 bg-black/60 pointer-events-none transition-transform group-hover:scale-110">
                        {member.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={member.image} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-2xl font-black text-neutral-600">{displayName.charAt(0).toUpperCase()}</span>
                        )}
                      </div>

                      <h3 className="pointer-events-none text-sm font-black tracking-wide text-neutral-50 uppercase">{displayName}</h3>

                      {roleLabel && (
                        <span className="pointer-events-none mt-3 inline-flex items-center rounded-sm bg-[#e4ae221a] px-2.5 py-1.5 font-mono text-[9px] font-black tracking-widest text-[#e4ae22] uppercase">
                          {roleLabel}
                        </span>
                      )}

                      {member.bio && (
                        <p className="pointer-events-none mt-4 line-clamp-4 text-xs leading-relaxed whitespace-pre-line text-neutral-400">{member.bio}</p>
                      )}

                      {links.length > 0 && (
                        <div className="relative z-10 mt-5 flex flex-wrap justify-center gap-2">
                          {links.map(([key, url]) => {
                            const Icon = SOCIAL_ICONS[key]!;
                            return (
                              <a
                                key={key}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={key}
                                style={{ "--brand": SOCIAL_BRAND_COLORS[key] ?? "#e4ae22" } as React.CSSProperties}
                                className="flex h-7 w-7 items-center justify-center rounded-sm border border-neutral-900 bg-white/5 text-neutral-400 transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)]"
                              >
                                <Icon className="h-3.5 w-3.5" />
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      {activeProjects.length > 0 && (
        <section className="space-y-4">
          <div className="border-b border-neutral-800 pb-2">
            <h2 className="text-xs font-bold tracking-[0.2em] text-neutral-200 uppercase">{t("projects.title")}</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {activeProjects.map((project) => {
              const style = PROJECT_TYPE_STYLE[project.type as AboutProjectType];
              const color = style?.color ?? "#e4ae22";
              const TypeIcon = style?.icon;
              const description = localized(project.description, locale as AppLocale);
              return (
                <div
                  key={project.id}
                  className="group relative flex flex-col items-center overflow-hidden rounded-sm border border-neutral-900 bg-[#050505] p-5 text-center shadow-lg transition-all duration-300 hover:bg-[var(--gcs-surface)]"
                >
                  <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: color }} />

                  {project.logoUrl && (
                    <div className="relative mb-3 flex h-14 w-14 flex-none items-center justify-center transition-transform group-hover:scale-110">
                      <ThemedLogoImage dark={project.logoUrl} light={project.logoUrl} alt={project.name} width={56} height={56} className="max-h-full max-w-full object-contain" />
                    </div>
                  )}

                  <h3 className="text-sm font-black tracking-wide text-neutral-50 uppercase">{project.name}</h3>

                  <span
                    className="mt-2 inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[9px] font-black tracking-widest uppercase"
                    style={{ background: `${color}1a`, color }}
                  >
                    {TypeIcon && <TypeIcon className="h-2.5 w-2.5" />}
                    {t(`projects.type.${project.type}` as "projects.type.Website")}
                  </span>

                  {description && <p className="mt-3 text-xs leading-relaxed whitespace-pre-line text-neutral-400">{description}</p>}

                  {project.url && (
                    <a href={project.url} target="_blank" rel="noopener noreferrer" className="absolute inset-0" aria-label={`${t("projects.visit")} ${project.name}`} />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

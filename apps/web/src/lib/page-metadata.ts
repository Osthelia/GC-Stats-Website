/**
 * GC-Stats - page-metadata
 *
 * Shared generateMetadata helpers for public pages: static translated titles
 * and "{entity} · {tab}" titles for player, team, tournament and organization pages.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { parseEntityId } from "@/lib/entity-id";
import { getPlayerPageInfo } from "@/lib/player-page-data";
import { getTeamPageInfo } from "@/lib/team-page-data";
import { getPublicTournamentHeader } from "@/lib/tournament-bracket-data";
import { getOrganizationPageInfo } from "@/lib/organization-page-data";

type LocaleParams = Promise<{ locale: string }>;

export function withSection(name: string, section?: string | null): string {
  return section ? `${name} · ${section}` : name;
}

// Returns a generateMetadata using a single translation key as title, e.g. "privacy.title".
export function staticTitleMetadata(key: string) {
  const dot = key.lastIndexOf(".");
  const namespace = key.slice(0, dot);
  const leaf = key.slice(dot + 1);
  return async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale: locale as AppLocale, namespace });
    return { title: t(leaf) };
  };
}

async function entityMetadata(
  locale: string,
  name: string | null | undefined,
  namespace: string,
  tabKey?: string,
): Promise<Metadata> {
  if (!name) return {};
  if (!tabKey) return { title: name };
  const t = await getTranslations({ locale: locale as AppLocale, namespace });
  return { title: withSection(name, t(tabKey)) };
}

export async function playerPageMetadata(locale: string, playerId: string, tabKey?: string): Promise<Metadata> {
  const id = parseEntityId(playerId);
  const player = id === null ? null : await getPlayerPageInfo(id);
  return entityMetadata(locale, player?.handle, "playerPage", tabKey);
}

export async function teamPageMetadata(locale: string, teamId: string, tabKey?: string): Promise<Metadata> {
  const id = parseEntityId(teamId);
  const team = id === null ? null : await getTeamPageInfo(id);
  return entityMetadata(locale, team?.name, "teamPage", tabKey);
}

// tabKey is a full key ("tournamentPage.tabStats") since pick'em sections live in another namespace.
export async function tournamentPageMetadata(locale: string, tournamentId: string, tabKey?: string): Promise<Metadata> {
  const id = parseEntityId(tournamentId);
  const tournament = id === null ? null : await getPublicTournamentHeader(id);
  if (!tournament || !tabKey) return entityMetadata(locale, tournament?.name, "tournamentPage");
  const dot = tabKey.lastIndexOf(".");
  return entityMetadata(locale, tournament.name, tabKey.slice(0, dot), tabKey.slice(dot + 1));
}

export async function organizationPageMetadata(locale: string, organizationId: string, tabKey?: string): Promise<Metadata> {
  const id = parseEntityId(organizationId);
  const organization = id === null ? null : await getOrganizationPageInfo(id);
  return entityMetadata(locale, organization?.name, "organizationPage", tabKey);
}

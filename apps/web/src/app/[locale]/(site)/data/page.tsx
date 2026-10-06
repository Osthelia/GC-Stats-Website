/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useTranslations } from "next-intl";
import { LegalPageHeader, LegalIntro, SectionCard, SectionText, icons } from "@/components/legal/ui";
import { DataCallout, FieldChip, FieldGroup, GroupDivider, LinkCard, TableCard } from "@/components/data/field-dictionary";

function ComingSoonBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-neutral-800 bg-black/25 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">
      {label}
    </span>
  );
}

export default function DataPage() {
  const t = useTranslations("dataPage");
  const f = useTranslations("dataPage.fields");

  function Row({ table, names, accent = false }: { table: string; names: string[]; accent?: boolean }) {
    return (
      <>
        {names.map((name) => (
          <FieldChip key={name} name={name} description={f(`${table}.${name}` as never)} accent={accent} />
        ))}
      </>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-16">
      <LegalPageHeader title={t("title")} />
      <LegalIntro>{t("subtitle")}</LegalIntro>

      <SectionCard icon={icons.database} title={t("openData.title")}>
        <div className="flex items-start justify-between gap-4">
          <SectionText>{t("openData.body")}</SectionText>
          <ComingSoonBadge label={t("openData.badge")} />
        </div>
      </SectionCard>

      {/* ---------------------------------------------------------------- People / Teams / Organizations */}
      <GroupDivider label={t("groups.identity")} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <TableCard index="01." title={t("sections.people")}>
          <FieldGroup label={f("people.titles.main")}>
            <Row table="people" names={["id", "handle"]} />
          </FieldGroup>
          <FieldGroup label={f("people.titles.additional")}>
            <Row table="people" names={["aliases", "firstName", "lastName", "countryCode", "secondaryCountryCode", "pronouns", "birthDate", "bio", "socials", "vlrId", "liquipediaLink"]} />
          </FieldGroup>
          <FieldGroup label={f("people.titles.confidential")}>
            <Row table="people" names={["valId", "esportsValId"]} accent />
          </FieldGroup>
        </TableCard>

        <LinkCard label="Roster_Memberships">
          <FieldGroup>
            <Row table="rosterMemberships" names={["personId", "teamId", "role", "period", "inactiveSince"]} />
          </FieldGroup>
        </LinkCard>

        <TableCard index="02." title={t("sections.teams")}>
          <FieldGroup label={f("teams.titles.main")}>
            <Row table="teams" names={["id", "name"]} />
          </FieldGroup>
          <FieldGroup label={f("teams.titles.additional")}>
            <Row table="teams" names={["shortName", "countryCode", "secondaryCountryCode", "socials", "bio", "vlrId", "liquipediaLink", "tags"]} />
          </FieldGroup>
        </TableCard>
      </div>

      <DataCallout text={t("descriptions.identity")} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <TableCard index="03." title={t("sections.organizations")}>
          <FieldGroup>
            <Row table="organizations" names={["id", "name", "slug", "tags", "countryCode", "socials"]} />
          </FieldGroup>
        </TableCard>

        <LinkCard label="Organization_Memberships">
          <FieldGroup>
            <Row table="organizationMemberships" names={["personId", "organizationId", "role", "period"]} />
          </FieldGroup>
        </LinkCard>

        <TableCard index="04." title="Production_Credits">
          <FieldGroup>
            <Row table="productionCredits" names={["personId", "organizationId", "role", "titleOverride", "scope"]} />
          </FieldGroup>
        </TableCard>
      </div>

      {/* ---------------------------------------------------------------- Accounts / moderation */}
      <GroupDivider label={t("groups.account")} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <TableCard index="05." title={t("sections.users")}>
          <FieldGroup label={f("users.titles.main")}>
            <Row table="users" names={["id", "username", "teamTag", "preferences", "pronouns", "bio", "socials"]} />
          </FieldGroup>
          <FieldGroup label={f("users.titles.security")}>
            <Row table="users" names={["email", "passwordHash", "twoFactorSecret", "twoFactorRecoveryCodes", "discordSyncedAt"]} accent />
          </FieldGroup>
        </TableCard>

        <TableCard index="06." title="Accounts & Authenticators">
          <FieldGroup label="Accounts">
            <Row table="accounts" names={["provider", "providerAccountId", "accessToken", "refreshToken"]} accent />
          </FieldGroup>
          <FieldGroup label="Authenticators">
            <Row table="authenticators" names={["name", "credentialId", "lastUsedAt"]} />
          </FieldGroup>
        </TableCard>

        <TableCard index="07." title="Sanctions & Sanction_Identities">
          <FieldGroup label="Sanctions">
            <Row table="sanctions" names={["type", "reason", "startsAt", "endsAt", "revokedAt", "issuedBy", "revokedBy"]} />
          </FieldGroup>
          <FieldGroup label="Sanction_Identities">
            <Row table="sanctionIdentities" names={["type", "value"]} accent />
          </FieldGroup>
        </TableCard>

        <TableCard index="08." title="User_Reports & Activity_Log">
          <FieldGroup label="User_Reports">
            <Row table="userReports" names={["category", "reason", "status", "reviewedBy", "resolutionNote"]} />
          </FieldGroup>
          <FieldGroup label="Activity_Log">
            <Row table="activityLog" names={["logName", "description", "event", "subjectType", "causerId", "attributeChanges"]} accent />
          </FieldGroup>
        </TableCard>
      </div>

      <DataCallout text={t("descriptions.account")} />

      {/* ---------------------------------------------------------------- Tournaments */}
      <GroupDivider label={t("groups.tournament")} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <TableCard index="09." title={t("sections.tournaments")}>
          <FieldGroup label={f("tournaments.titles.main")}>
            <Row table="tournaments" names={["id", "name", "region", "category", "status"]} />
          </FieldGroup>
          <FieldGroup label={f("tournaments.titles.additional")}>
            <Row table="tournaments" names={["prizePool", "location", "startDate", "endDate", "description", "liquipediaLink", "socials"]} />
          </FieldGroup>
        </TableCard>

        <TableCard index="10." title="Stages & Stage_Containers">
          <FieldGroup label={f("stages.titles.structure")}>
            <Row table="stages" names={["name", "sequenceOrder", "status", "startDate", "endDate", "liquipediaLink", "containerType", "config"]} />
          </FieldGroup>
        </TableCard>

        <div className="flex flex-col gap-6">
          <LinkCard label="Entrants">
            <FieldGroup>
              <Row table="entrants" names={["tournamentId", "kind", "teamId", "displayName", "seed"]} />
            </FieldGroup>
          </LinkCard>
          <LinkCard label="Entrant_Members">
            <FieldGroup>
              <Row table="entrantMembers" names={["personId", "role", "isStarter"]} />
            </FieldGroup>
          </LinkCard>
        </div>
      </div>

      <TableCard index="11." title="Stage_Qualifications & Point_Entries">
        <FieldGroup>
          <Row table="qualifications" names={["destinationType", "placement", "placementLabel", "points", "cashPrizeAmount", "rank", "amount", "reason"]} />
        </FieldGroup>
      </TableCard>

      <DataCallout text={t("descriptions.tournament")} />

      {/* ---------------------------------------------------------------- Matches / aggregated game stats */}
      <GroupDivider label={t("groups.matches")} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <TableCard index="12." title={t("sections.matches")} className="lg:col-span-2">
          <FieldGroup label={f("matches.titles.structure")}>
            <Row
              table="matches"
              names={["id", "containerId", "round", "label", "bestOf", "status", "entrantAId", "entrantBId", "scoreA", "scoreB", "winnerId", "scheduledAt", "patch"]}
            />
          </FieldGroup>
        </TableCard>

        <TableCard index="13." title="Match_Vetos">
          <FieldGroup>
            <Row table="matchVetos" names={["matchId", "entrantId", "mapName", "type", "order", "side", "sidePickedByEntrantId"]} />
          </FieldGroup>
        </TableCard>

        <TableCard index="14." title="Maps">
          <FieldGroup>
            <Row table="maps" names={["id", "apiMatchId", "matchId", "mapName", "gameMode", "teamAScore", "teamBScore", "order", "isCompleted"]} />
          </FieldGroup>
        </TableCard>

        <TableCard index="15." title="Map_Player_Stats" className="md:col-span-2">
          <FieldGroup>
            <Row
              table="mapPlayerStats"
              names={[
                "agentName",
                "kills",
                "deaths",
                "assists",
                "acs",
                "adr",
                "kastPercentage",
                "firstKills",
                "firstDeaths",
                "headshotPercentage",
                "clutches",
                "multikills",
                "tradeKills",
                "tradedDeaths",
                "roundTypeSplits",
                "fallDeaths",
                "weaponKills",
              ]}
            />
          </FieldGroup>
        </TableCard>

        <TableCard index="16." title="Map_Team_Round_Summary">
          <FieldGroup>
            <Row table="mapTeamRoundSummary" names={["side", "roundsPlayed", "roundsWon"]} />
          </FieldGroup>
        </TableCard>
      </div>

      <DataCallout text={t("descriptions.matches")} />

      {/* ---------------------------------------------------------------- News / community */}
      <GroupDivider label={t("groups.news")} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <TableCard index="17." title={t("sections.news")}>
          <FieldGroup label={f("news.titles.main")}>
            <Row table="news" names={["id", "authorId", "organizationId", "lang", "title", "slug", "excerpt", "content", "imageCover"]} />
          </FieldGroup>
          <FieldGroup label={f("news.titles.additional")}>
            <Row table="news" names={["status", "isFeatured", "showOnHome", "publishedAt", "createdAt", "updatedAt"]} />
          </FieldGroup>
        </TableCard>

        <LinkCard label="News_Relations">
          <FieldGroup>
            <Row table="newsRelations" names={["relatableType", "relatableId"]} />
          </FieldGroup>
        </LinkCard>

        <TableCard index="18." title="Forum_Threads & Forum_Messages">
          <FieldGroup label="Forum_Threads">
            <Row table="forumThreads" names={["category", "subjectType", "title", "lastMessageAt"]} />
          </FieldGroup>
          <FieldGroup label="Forum_Messages">
            <Row table="forumMessages" names={["body", "parentId", "hiddenAt"]} />
          </FieldGroup>
        </TableCard>

        <TableCard index="19." title={t("sections.reactionsEmotes")}>
          <FieldGroup label="Emotes">
            <Row table="emotes" names={["name", "imagePath", "source", "isActive"]} />
          </FieldGroup>
          <FieldGroup label="Reactions">
            <Row table="reactions" names={["emoteId", "userId", "reactableType"]} />
          </FieldGroup>
        </TableCard>
      </div>

      <DataCallout text={t("descriptions.news")} />

      {/* ---------------------------------------------------------------- Raw game data (round-by-round) — last, lowest priority */}
      <GroupDivider label={t("groups.rawStats")} />

      <div className="grid grid-cols-1 gap-6">
        <TableCard index="20." title="Map_Rounds_Raw">
          <FieldGroup>
            <Row table="mapRoundsRaw" names={["roundNumber", "winningEntrantId", "winType", "atkEntrantId", "defEntrantId", "plantSite", "plantX", "plantY"]} />
          </FieldGroup>
        </TableCard>

        <TableCard index="21." title="Map_Round_Kills_Raw & Damages_Raw">
          <FieldGroup label="Kills">
            <Row table="mapRoundKillsRaw" names={["killerPersonId", "victimPersonId", "assistantPersonIds", "timeMs", "weapon", "damageType", "isSecondaryFire"]} />
          </FieldGroup>
          <FieldGroup label="Damages">
            <Row table="mapRoundDamagesRaw" names={["attackerPersonId", "receiverPersonId", "damage", "headshots", "bodyshots", "legshots"]} />
          </FieldGroup>
        </TableCard>

        <TableCard index="22." title="Map_Round_Alive_States_Raw & Loadouts_Raw">
          <FieldGroup label="Alive_States">
            <Row table="mapRoundAliveStatesRaw" names={["sequence", "timeMs", "atkAlive", "defAlive", "winnerSide"]} />
          </FieldGroup>
          <FieldGroup label="Loadouts">
            <Row table="mapRoundPlayerLoadoutsRaw" names={["personId", "kills", "assists", "score", "loadoutValue", "economySpent", "economyRemaining", "weapon", "armor"]} />
          </FieldGroup>
        </TableCard>

        <TableCard index="23." title="Map_Round_Player_Positions_Raw">
          <FieldGroup>
            <Row table="mapRoundPlayerPositionsRaw" names={["eventType", "personId", "role", "x", "y", "viewRadians", "timeMs"]} />
          </FieldGroup>
        </TableCard>
      </div>

      <DataCallout text={t("descriptions.rawStats")} />

      {/* ---------------------------------------------------------------- Others */}
      <GroupDivider label={t("groups.others")} />

      <TableCard index="24." title="Page_Views">
        <FieldGroup label={f("pageViews.titles.main")}>
          <Row table="pageViews" names={["uri", "viewedAt", "count", "countryCode", "regionCode"]} />
        </FieldGroup>
      </TableCard>

      <DataCallout text={t("descriptions.others")} />
    </div>
  );
}

/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { redirect } from "@/i18n/navigation";
import { getCurrentUserId } from "@/lib/session";
import { adminDb as db } from "@gc-stats/db/client";
import { users, accounts, authenticators } from "@gc-stats/db";
import { EmailSettings } from "@/components/settings/email-settings";
import { PasswordSettings } from "@/components/settings/password-settings";
import { TwoFactorSettings } from "@/components/settings/two-factor-settings";
import { ConnectedAccountsSettings } from "@/components/settings/connected-accounts-settings";
import { PasskeysSettings } from "@/components/settings/passkeys-settings";
import { EmailNotificationsSettings } from "@/components/settings/email-notifications-settings";
import { DiscordNotificationsSettings } from "@/components/settings/discord-notifications-settings";
import { AccountDangerZone } from "@/components/settings/account-danger-zone";
import { SettingsNav } from "@/components/settings/settings-nav";
import { EMAIL_CATEGORIES, type EmailCategory } from "@/lib/notification-categories";
import { hasJoinedDiscordGuild } from "@/lib/discord-guild-membership";
import { SettingsCard } from "@/components/settings/settings-card";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "accountSettings" });
  return { title: t("title") };
}

export default async function AccountSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ linked?: string; linkError?: string }>;
}) {
  const { locale } = await params;
  const { linked, linkError } = await searchParams;
  setRequestLocale(locale as AppLocale);

  const userId = await getCurrentUserId();
  if (!userId) {
    redirect({ href: "/login", locale: locale as AppLocale });
    return null;
  }

  const [[user], linkedAccounts, passkeys] = await Promise.all([
    db
      .select({
        email: users.email,
        emailVerified: users.emailVerified,
        name: users.name,
        passwordHash: users.passwordHash,
        twoFactorConfirmedAt: users.twoFactorConfirmedAt,
        preferences: users.preferences,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    db.select({ provider: accounts.provider, providerAccountId: accounts.providerAccountId }).from(accounts).where(eq(accounts.userId, userId)),
    db
      .select({
        credentialID: authenticators.credentialID,
        name: authenticators.name,
        createdAt: authenticators.createdAt,
        lastUsedAt: authenticators.lastUsedAt,
      })
      .from(authenticators)
      .where(eq(authenticators.userId, userId)),
  ]);

  // Same count as lib/account-security countAuthMethods(), from the rows already loaded.
  const authMethods = (user?.passwordHash ? 1 : 0) + linkedAccounts.length + passkeys.length;
  const discordId = linkedAccounts.find((a) => a.provider === "discord")?.providerAccountId ?? null;

  const t = await getTranslations({ locale: locale as AppLocale, namespace: "accountSettings" });
  const canRemoveAMethod = authMethods > 1;
  const hasPassword = Boolean(user?.passwordHash);
  const storedPrefs = (user?.preferences as { emailNotifications?: Partial<Record<EmailCategory, boolean>> } | null)?.emailNotifications;
  // Opt-in: no stored preference means off, never on by default.
  const emailPrefs = Object.fromEntries(EMAIL_CATEGORIES.map((c) => [c, storedPrefs?.[c] ?? false])) as Record<EmailCategory, boolean>;
  const storedDiscordPrefs = (user?.preferences as { discordNotifications?: Partial<Record<EmailCategory, boolean>> } | null)?.discordNotifications;
  const discordPrefs = Object.fromEntries(EMAIL_CATEGORIES.map((c) => [c, storedDiscordPrefs?.[c] ?? false])) as Record<EmailCategory, boolean>;

  return (
    <div className="mx-auto max-w-[1000px] px-6 pt-16 pb-28">
      <div className="mb-8">
        <h1 className="mb-2 text-[28px] font-bold tracking-tight text-neutral-50">{t("title")}</h1>
        <p className="text-[14.5px] text-neutral-400">{t("subtitle")}</p>
      </div>

      <SettingsNav active="account" />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <EmailSettings currentEmail={user?.email ?? ""} emailVerified={Boolean(user?.emailVerified)} hasPassword={hasPassword} />
          <PasswordSettings hasPassword={hasPassword} canRemove={canRemoveAMethod} />
          <TwoFactorSettings hasPassword={hasPassword} enabled={Boolean(user?.twoFactorConfirmedAt)} />
        </div>
        <div className="flex flex-col gap-5">
          <ConnectedAccountsSettings
            linkedProviders={linkedAccounts.map((a) => a.provider)}
            canUnlink={canRemoveAMethod}
            linkedNotice={linked}
            linkErrorNotice={linkError}
          />
          <PasskeysSettings
            passkeys={passkeys.map((p) => ({
              credentialID: p.credentialID,
              name: p.name,
              createdAt: p.createdAt.toISOString(),
              lastUsedAt: p.lastUsedAt?.toISOString() ?? null,
            }))}
            canDelete={canRemoveAMethod}
            userEmail={user?.email ?? ""}
            userName={user?.name ?? null}
          />
          <EmailNotificationsSettings initialPrefs={emailPrefs} />
          {/* The guild check calls the Discord API — streamed so it never holds up the rest of the page. */}
          <Suspense fallback={<DiscordNotificationsSkeleton heading={t("discordNotifications.heading")} />}>
            <DiscordNotificationsSection userId={userId} discordId={discordId} initialPrefs={discordPrefs} />
          </Suspense>
        </div>
      </div>

      <div className="mt-5">
        <AccountDangerZone hasPassword={hasPassword} />
      </div>
    </div>
  );
}

async function DiscordNotificationsSection({
  userId,
  discordId,
  initialPrefs,
}: {
  userId: string;
  discordId: string | null;
  initialPrefs: Record<EmailCategory, boolean>;
}) {
  const joined = discordId ? await hasJoinedDiscordGuild(userId) : false;
  return (
    <DiscordNotificationsSettings
      initialPrefs={initialPrefs}
      initiallyLinked={Boolean(discordId)}
      initiallyJoined={joined}
      inviteUrl={process.env.DISCORD_INVITE_URL ?? null}
    />
  );
}

function DiscordNotificationsSkeleton({ heading }: { heading: string }) {
  return (
    <SettingsCard heading={heading}>
      <div aria-hidden="true" className="h-[120px] animate-pulse rounded-[10px] bg-[var(--gcs-surface-2)]" />
    </SettingsCard>
  );
}

/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { redirect as externalRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { and, eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { oauthConsents, users } from "@gc-stats/db";
import type { AppLocale } from "@/i18n/routing";
import { redirect } from "@/i18n/navigation";
import { getCurrentUserId } from "@/lib/session";
import { resolveOAuthClient } from "@/lib/oauth/client-auth";
import { parseScopeParam } from "@/lib/oauth/scopes";
import { issueAuthorizationCode } from "@/lib/oauth/issue-code";
import { isValidCodeChallenge } from "@/lib/oauth/token-crypto";
import { OAuthConsentScreen } from "@/components/oauth/oauth-consent-screen";

type SearchParams = {
  client_id?: string;
  redirect_uri?: string;
  response_type?: string;
  scope?: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
};

function GenericError({ message }: { message: string }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[440px] flex-col items-center justify-center px-6 text-center">
      <p className="text-[15px] text-neutral-300">{message}</p>
    </div>
  );
}

export default async function OAuthAuthorizePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const sp = await searchParams;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "oauth" });

  // Nothing here may redirect to redirect_uri until it's been verified
  // against the resolved client's registered list — an unverified redirect
  // target is the classic OAuth open-redirect hole.
  if (!sp.client_id) return <GenericError message={t("error.invalidRequest")} />;

  const client = await resolveOAuthClient(sp.client_id);
  if (!client) return <GenericError message={t("error.invalidClient")} />;

  if (!sp.redirect_uri || !client.redirectUris.includes(sp.redirect_uri)) {
    return <GenericError message={t("error.invalidRedirectUri")} />;
  }
  const redirectUri = sp.redirect_uri;

  const failToClient = (error: string): never => {
    const url = new URL(redirectUri);
    url.searchParams.set("error", error);
    if (sp.state) url.searchParams.set("state", sp.state);
    externalRedirect(url.toString());
  };

  if (sp.response_type !== "code") failToClient("unsupported_response_type");
  if (!sp.code_challenge || !isValidCodeChallenge(sp.code_challenge)) failToClient("invalid_request");
  if (sp.code_challenge_method && sp.code_challenge_method !== "S256") failToClient("invalid_request");

  const requestedScopes = parseScopeParam(sp.scope ?? null);
  if (requestedScopes.some((s) => !client.allowedScopes.includes(s))) failToClient("invalid_scope");

  const userId = await getCurrentUserId();
  if (!userId) {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      if (value) qs.set(key, value);
    }
    const callbackUrl = `/oauth/authorize?${qs.toString()}`;
    redirect({ href: { pathname: "/login", query: { callbackUrl } }, locale: locale as AppLocale });
    return null;
  }

  const [existingConsent] = await db
    .select({ scopes: oauthConsents.scopes })
    .from(oauthConsents)
    .where(and(eq(oauthConsents.userId, userId), eq(oauthConsents.clientId, client.id)))
    .limit(1);

  const alreadyGranted = existingConsent && requestedScopes.every((s) => existingConsent.scopes.includes(s));
  if (alreadyGranted) {
    const code = await issueAuthorizationCode({
      clientDbId: client.id,
      userId,
      redirectUri,
      scopes: requestedScopes,
      codeChallenge: sp.code_challenge!,
      codeChallengeMethod: "S256",
    });
    const url = new URL(redirectUri);
    url.searchParams.set("code", code);
    if (sp.state) url.searchParams.set("state", sp.state);
    externalRedirect(url.toString());
  }

  const [user] = await db.select({ username: users.username }).from(users).where(eq(users.id, userId)).limit(1);

  return (
    <OAuthConsentScreen
      clientName={client.name}
      clientLogoUrl={client.logoUrl}
      username={user?.username ?? ""}
      scopes={requestedScopes}
      params={{
        clientId: client.clientId,
        redirectUri,
        scopes: requestedScopes,
        state: sp.state ?? null,
        codeChallenge: sp.code_challenge!,
        codeChallengeMethod: "S256",
      }}
    />
  );
}

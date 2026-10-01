/**
 * GC-Stats - issue-code
 *
 * Issues a short-lived OAuth authorization code, hashed at rest, shared by
 * the silent re-consent path and the explicit Allow action.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { adminDb as db } from "@gc-stats/db/client";
import { oauthAuthorizationCodes } from "@gc-stats/db";
import { generateOpaqueToken, hashOpaqueToken } from "@/lib/oauth/token-crypto";
import type { OAuthScope } from "@/lib/oauth/scopes";

const CODE_TTL_MS = 60_000;

/** Shared by the silent re-consent path (/oauth/authorize, an existing consent already covers the request) and the explicit Allow action (actions/oauth-authorize.ts). */
export async function issueAuthorizationCode(params: {
  clientDbId: number;
  userId: string;
  redirectUri: string;
  scopes: OAuthScope[];
  codeChallenge: string;
  codeChallengeMethod: string;
}): Promise<string> {
  const plainCode = generateOpaqueToken("gcs_ac_");
  await db.insert(oauthAuthorizationCodes).values({
    codeHash: hashOpaqueToken(plainCode),
    clientId: params.clientDbId,
    userId: params.userId,
    redirectUri: params.redirectUri,
    scopes: params.scopes,
    codeChallenge: params.codeChallenge,
    codeChallengeMethod: params.codeChallengeMethod,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });
  return plainCode;
}

/**
 * GC-Stats — NextAuth configuration
 *
 * Providers, adapter and callbacks for authentication: Discord/Twitch/
 * Twitter OAuth, WebAuthn passkeys, and credentials login with two-factor
 * and throttling checks.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import NextAuth, { CredentialsSignin } from "next-auth";
import type { Provider } from "next-auth/providers";
import Discord from "next-auth/providers/discord";
import Twitch from "next-auth/providers/twitch";
import Twitter from "next-auth/providers/twitter";
import Credentials from "next-auth/providers/credentials";
import WebAuthn from "next-auth/providers/webauthn";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import bcrypt from "bcryptjs";
import { adminDb as db } from "@gc-stats/db/client";
import { users, accounts, sessions, verificationTokens, authenticators } from "@gc-stats/db";
import { and, eq } from "drizzle-orm";
import { generateUsername } from "@/lib/username";
import { decrypt, encrypt } from "@/lib/encryption";
import { verifyTotpToken, claimTotpCode } from "@/lib/two-factor";
import { consumeSessionReissueToken } from "@/lib/session-reissue";
import { getClientIp } from "@/lib/client-ip";
import { checkLoginThrottle, checkTwoFactorThrottle } from "@/lib/auth-throttle";
import { markEmailVerifiedFromProvider } from "@/lib/email-verification";

// `.code` ends up as the `code` query param on a `redirect:false` signIn()'s
// result (see @auth/core/index.js: `if (error instanceof CredentialsSignin)
// params.set("code", error.code)`) — the client (auth-form.tsx) branches on
// this to show a second "enter your 2FA code" step instead of a plain
// "wrong email or password" message.
class TwoFactorRequiredError extends CredentialsSignin {
  code = "two-factor-required";
}
class InvalidTwoFactorCodeError extends CredentialsSignin {
  code = "invalid-two-factor-code";
}
class TooManyAttemptsError extends CredentialsSignin {
  code = "too-many-attempts";
}

// Compared against when the email is unknown, so both paths cost one bcrypt
// round and response time doesn't reveal which emails have an account.
const DUMMY_PASSWORD_HASH = "$2b$12$q3xvNld84D5uTFYYEB7pfeirungxFHjvrmNmApCTxOmqoLV7tC0Jy";

// Same lib/adapter shape as TournamentPlatform/apps/web/src/auth.ts. GC-Stats
// adds a WebAuthn (passkey) provider on top — TournamentPlatform doesn't have
// one yet.
const providers: Provider[] = [
  Discord({
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    // "guilds" is needed to check server membership for Discord DM
    // notifications (lib/discord-guild-membership.ts) — Discord only lets a
    // bot DM a user they share a server with.
    authorization: { params: { scope: "identify email guilds" } },
  }),
  Twitch({
    clientId: process.env.TWITCH_CLIENT_ID,
    clientSecret: process.env.TWITCH_CLIENT_SECRET,
    // Default claims plus email_verified (lib/email-verification.ts).
    authorization: {
      params: {
        scope: "openid user:read:email",
        claims: { id_token: { email: null, email_verified: null, picture: null, preferred_username: null } },
      },
    },
  }),
  Twitter({
    clientId: process.env.TWITTER_CLIENT_ID,
    clientSecret: process.env.TWITTER_CLIENT_SECRET,
  }),
  Credentials({
    id: "credentials",
    name: "Email / password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
      code: { label: "2FA code", type: "text" },
      recoveryCode: { label: "Recovery code", type: "text" },
    },
    async authorize(credentials, request) {
      const rawEmail = credentials?.email;
      const password = credentials?.password;
      if (typeof rawEmail !== "string" || typeof password !== "string") return null;
      // Stored lowercased at registration (actions/register.ts).
      const email = rawEmail.trim().toLowerCase();

      // Sliding-window throttle keyed on email + IP — both /api/auth/callback/credentials
      // and the 6-digit TOTP check below sit outside proxy.ts's matcher (it
      // explicitly excludes /api), so this is the only place a limit can gate them.
      const ip = getClientIp(request.headers);
      if (!(await checkLoginThrottle(email, ip))) throw new TooManyAttemptsError();

      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
      // No such user, or an OAuth/passkey only account with no password set.
      if (!user?.passwordHash || !valid) return null;

      if (user.twoFactorConfirmedAt) {
        const code = typeof credentials.code === "string" ? credentials.code.trim() : "";
        const recoveryCode = typeof credentials.recoveryCode === "string" ? credentials.recoveryCode.trim().toLowerCase() : "";

        if (!code && !recoveryCode) throw new TwoFactorRequiredError();

        // Independent, stricter limit: password + IP throttle above already
        // slows down credential stuffing, but an attacker who already has a
        // valid password (breach, reuse) would otherwise get unlimited shots
        // at the 6-digit TOTP space.
        if (!(await checkTwoFactorThrottle(user.id))) throw new TooManyAttemptsError();

        if (code) {
          const secret = decrypt(user.twoFactorSecret!);
          if (!(await verifyTotpToken(code, secret))) throw new InvalidTwoFactorCodeError();
          // A code seen once (shoulder surfing, realtime phishing) can't log in twice.
          if (!(await claimTotpCode(user.id, code))) throw new InvalidTwoFactorCodeError();
        } else {
          const storedCodes: string[] = user.twoFactorRecoveryCodes ? JSON.parse(decrypt(user.twoFactorRecoveryCodes)) : [];
          if (!storedCodes.includes(recoveryCode)) throw new InvalidTwoFactorCodeError();
          // Single use, and conditional on the list we read: of two concurrent
          // logins with the same code, only one gets through.
          const remaining = storedCodes.filter((c) => c !== recoveryCode);
          const [redeemed] = await db
            .update(users)
            .set({ twoFactorRecoveryCodes: encrypt(JSON.stringify(remaining)) })
            .where(and(eq(users.id, user.id), eq(users.twoFactorRecoveryCodes, user.twoFactorRecoveryCodes!)))
            .returning({ id: users.id });
          if (!redeemed) throw new InvalidTwoFactorCodeError();
        }
      }

      return { id: user.id, name: user.name, email: user.email, image: user.image, username: user.username };
    },
  }),
  WebAuthn({
    // Default getUserInfo (email lookup) + default relayingParty (derived
    // from the request URL) are both fine for a single-domain site.
  }),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
    authenticatorsTable: authenticators,
  }),
  experimental: { enableWebAuthn: true },
  providers,
  // The Credentials provider can't be persisted through the adapter's
  // `sessions` table by design (Auth.js requires the app to own that
  // lookup) — JWT sessions work uniformly for every provider here
  // (OAuth/WebAuthn included), so there's one session strategy for the
  // whole app rather than branching by provider.
  session: { strategy: "jwt" },
  callbacks: {
    // Runs once per actual sign-in, before the JWT is minted — the one place
    // that's both after the adapter has persisted the user (so `user.id`
    // exists for OAuth/WebAuthn signups) and early enough that mutating
    // `user` here still flows into `jwt()` below. Backfills `username` for
    // OAuth/WebAuthn signups, which never go through actions/register.ts —
    // mirrors V1's UsernameGenerator fallback. Credentials logins always
    // already have a username (set at registration), so this is a no-op there.
    async signIn({ user, account, profile }) {
      // Linking an OAuth provider from an already-authenticated context
      // (the "Connect" button in /settings/account) — this MUST run before
      // the account/user check below returns, because returning a string
      // here short-circuits Auth.js's normal handleLoginOrRegister
      // (createUser/linkAccount) entirely; see @auth/core's
      // handleAuthorized: a string return skips straight to redirect()
      // without ever touching the adapter. That's what makes it safe to
      // write the `accounts` row ourselves instead of letting the adapter
      // attach this OAuth identity to a brand-new user record.
      if (account && (account.type === "oauth" || account.type === "oidc")) {
        const [existingLink] = await db
          .select({ userId: accounts.userId })
          .from(accounts)
          .where(and(eq(accounts.provider, account.provider), eq(accounts.providerAccountId, account.providerAccountId)))
          .limit(1);

        // `auth()` reads the incoming request's cookies via next/headers —
        // safe to call here even though we're inside this very NextAuth()
        // config, since it just decodes the JWT session cookie already on
        // the request, it doesn't re-enter this OAuth callback flow.
        const activeSession = await auth();
        const activeUserId = activeSession?.user?.id;

        if (activeUserId) {
          if (existingLink && existingLink.userId !== activeUserId) {
            return "/settings/account?linkError=alreadyLinkedElsewhere";
          }
          if (!existingLink) {
            await db.insert(accounts).values({
              userId: activeUserId,
              type: account.type,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              refresh_token: account.refresh_token,
              access_token: account.access_token,
              expires_at: typeof account.expires_at === "number" ? account.expires_at : undefined,
              token_type: account.token_type,
              scope: account.scope,
              id_token: account.id_token,
              session_state: typeof account.session_state === "string" ? account.session_state : undefined,
            });
          }
          await markEmailVerifiedFromProvider(activeUserId, account.provider, profile);
          return `/settings/account?linked=${account.provider}`;
        }
        // No active session: a normal login/signup through this provider —
        // fall through to the framework's default handling below.
      }

      if (user.id && !user.username) {
        user.username = await generateUsername(user.name ?? user.email);
        await db.update(users).set({ username: user.username }).where(eq(users.id, user.id));
      }
      return true;
    },
    // `user` is only passed on the initial sign-in. Every other call re-reads
    // `username` and `sessionsInvalidatedAt` from the DB rather than trusting
    // `session`: that payload comes from the client (`useSession().update()`,
    // i.e. POST /api/auth/session) and anyone holding a cookie can send it.
    //
    // JWT sessions never touch the adapter's `sessions` table, so revocation
    // lives here: password/2FA/email changes and adminRevokeUserSessions bump
    // `sessionsInvalidatedAt`, and any token authenticated before that dies.
    // The only way back is a one-time reissue token that the credential
    // changing server action returns to its own caller (lib/session-reissue.ts),
    // never something a stolen cookie can produce.
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.username = user.username;
        token.authAt = Date.now();
        return token;
      }
      if (typeof token.sub !== "string") return token;

      const [dbUser] = await db
        .select({ username: users.username, email: users.email, sessionsInvalidatedAt: users.sessionsInvalidatedAt })
        .from(users)
        .where(eq(users.id, token.sub))
        .limit(1);

      if (!dbUser) {
        token.sub = undefined;
        return token;
      }

      const invalidatedAtMs = dbUser.sessionsInvalidatedAt?.getTime();
      // Tokens minted before authAt existed fall back to iat (refreshed on
      // every re-encode, but always checked before re-encoding).
      const validSinceMs = Math.max(token.authAt ?? (typeof token.iat === "number" ? token.iat * 1000 : 0), token.reissuedAt ?? 0);
      if (invalidatedAtMs && invalidatedAtMs > validSinceMs) {
        const reissueToken = trigger === "update" && typeof session?.reissueToken === "string" ? session.reissueToken : null;
        if (!reissueToken || !(await consumeSessionReissueToken(token.sub, reissueToken))) {
          token.sub = undefined;
          return token;
        }
        token.reissuedAt = Date.now();
      }

      token.username = dbUser.username ?? undefined;
      token.email = dbUser.email;
      return token;
    },
    // Auth.js sets `token.sub` to the user id automatically on sign-in, but
    // does NOT copy it (or our custom `username`) onto `session.user` by
    // default — `session.user` only gets name/email/image out of the box.
    // Without this, `session.user.id`/`.username` are always undefined and
    // every "who is logged in" check reads as "logged out".
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.username = token.username;
        session.authAt = token.authAt;
      }
      return session;
    },
  },
  events: {
    // Fires once per actual sign-in, not per request (session reads use the
    // JWT strategy above and never touch the DB).
    async signIn({ user, account, profile }) {
      if (user.id) {
        await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
        if (account) await markEmailVerifiedFromProvider(user.id, account.provider, profile);
      }
    },
  },
  pages: {
    // Unprefixed on purpose: Auth.js has no concept of next-intl locales, so
    // this always resolves to "/login" — the next-intl proxy (src/proxy.ts)
    // then redirects that to "/<default-locale>/login" the same way it does
    // for any other unprefixed path, since localePrefix is "always".
    signIn: "/login",
  },
});

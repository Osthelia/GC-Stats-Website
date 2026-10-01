/**
 * GC-Stats - next-auth.d
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { DefaultSession } from "next-auth";

// `username` isn't part of Auth.js's DefaultUser/Session — added here so
// header-auth-status.tsx can link to /user/[username] without an extra query.
declare module "next-auth" {
  interface User {
    username?: string | null;
  }
  interface Session {
    user: {
      username?: string | null;
    } & DefaultSession["user"];
    /** Epoch ms of the last real sign-in, for "recently authenticated" checks. */
    authAt?: number;
  }
}

// next-auth/jwt.d.ts just re-exports `@auth/core/jwt` — augmenting that
// re-export module doesn't merge with the original declaration, so target
// the source module the JWT type actually comes from.
declare module "@auth/core/jwt" {
  interface JWT {
    username?: string | null;
    /** Epoch ms of the last real sign-in. */
    authAt?: number;
    /** Epoch ms of the last reissue after a credential change (see lib/session-reissue.ts). */
    reissuedAt?: number;
  }
}

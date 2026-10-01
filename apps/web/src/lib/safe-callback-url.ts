/**
 * GC-Stats - safe-callback-url
 *
 * Only ever redirect back into our own app after login/register: rejects an
 * absolute URL or a protocol-relative one, which would be an open redirect.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export function safeCallbackUrl(callbackUrl: string | undefined): string | undefined {
  if (!callbackUrl || !callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) return undefined;
  return callbackUrl;
}

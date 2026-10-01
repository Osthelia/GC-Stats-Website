/**
 * GC-Stats - oauth-consent-screen
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plug, ShieldCheck } from "lucide-react";
import { approveAuthorization, denyAuthorization, type AuthorizeParams } from "@/actions/oauth-authorize";
import type { OAuthScope } from "@/lib/oauth/scope-list";

function ClientLogo({ logoUrl, name }: { logoUrl: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  if (!logoUrl || broken) {
    return (
      <span className="flex h-14 w-14 items-center justify-center rounded-[14px] bg-neutral-800 text-neutral-400">
        <Plug className="h-7 w-7" />
      </span>
    );
  }
  return <img src={logoUrl} alt={name} className="h-14 w-14 rounded-[14px] object-cover" onError={() => setBroken(true)} />;
}

export function OAuthConsentScreen({ clientName, clientLogoUrl, username, scopes, params }: { clientName: string; clientLogoUrl: string | null; username: string; scopes: OAuthScope[]; params: AuthorizeParams }) {
  const t = useTranslations("oauth.consent");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  function handleApprove() {
    setError(false);
    startTransition(async () => {
      const result = await approveAuthorization(params);
      if ("error" in result) {
        setError(true);
        return;
      }
      window.location.href = result.redirectTo;
    });
  }

  function handleDeny() {
    startTransition(async () => {
      const result = await denyAuthorization({ clientId: params.clientId, redirectUri: params.redirectUri, state: params.state });
      if ("error" in result) {
        setError(true);
        return;
      }
      window.location.href = result.redirectTo;
    });
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[440px] flex-col items-center justify-center px-6 py-16">
      <div className="w-full rounded-[16px] border border-neutral-800 bg-[var(--gcs-surface)] p-7">
        <div className="mb-5 flex items-center gap-4">
          <ClientLogo logoUrl={clientLogoUrl} name={clientName} />
          <div className="min-w-0">
            <p className="text-[17px] font-semibold text-neutral-50">{clientName}</p>
            <p className="mt-0.5 text-[13px] text-neutral-500">{t("wantsToAccess", { username })}</p>
          </div>
        </div>

        <ul className="mb-6 flex flex-col gap-2.5">
          {scopes.map((scope) => (
            <li key={scope} className="flex items-start gap-2.5 text-[13.5px] text-neutral-300">
              <ShieldCheck className="mt-0.5 h-4 w-4 flex-none text-[#7cc48a]" />
              <span>{t(`scope.${scope}`)}</span>
            </li>
          ))}
        </ul>

        {error && <p role="alert" className="mb-4 text-[13px] text-[#e08585]">{t("error")}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleDeny}
            disabled={isPending}
            className="flex-1 rounded-[10px] border border-neutral-700 px-4 py-2.5 text-[14px] font-medium text-neutral-200 transition-colors hover:border-neutral-600 hover:bg-[var(--gcs-hover)] disabled:opacity-60"
          >
            {t("deny")}
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={isPending}
            className="flex-1 rounded-[10px] bg-[#e4ae22] px-4 py-2.5 text-[14px] font-semibold text-neutral-950 transition-colors hover:bg-[#f0ba33] disabled:opacity-60"
          >
            {isPending ? t("pending") : t("allow")}
          </button>
        </div>
      </div>
    </div>
  );
}

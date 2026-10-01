/**
 * GC-Stats - connected-apps-settings
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plug } from "lucide-react";
import { revokeOAuthConsent } from "@/actions/oauth-connections";
import { useConfirmClick } from "@/lib/use-confirm-click";
import { FormattedDate } from "@/components/formatted-date";
import type { ConnectedAppRow } from "@/lib/oauth-consents";
import type { OAuthScope } from "@/lib/oauth/scope-list";
import { SettingsCard } from "./settings-card";

function AppLogo({ logoUrl, name }: { logoUrl: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  if (!logoUrl || broken) {
    return (
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] bg-neutral-800 text-neutral-400">
        <Plug className="h-[18px] w-[18px]" />
      </span>
    );
  }
  return <img src={logoUrl} alt={name} className="h-8 w-8 flex-none rounded-[8px] object-cover" onError={() => setBroken(true)} />;
}

function RevokeButton({ label, confirmLabel, disabled, onConfirm }: { label: string; confirmLabel: string; disabled: boolean; onConfirm: () => void }) {
  const { confirming, handleClick } = useConfirmClick(onConfirm);
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className="rounded-[8px] px-3 py-1.5 text-[13px] font-medium text-[#e08585] transition-colors hover:bg-[#e08585]/10 disabled:opacity-60"
    >
      {confirming ? confirmLabel : label}
    </button>
  );
}

export function ConnectedAppsSettings({ apps }: { apps: ConnectedAppRow[] }) {
  const t = useTranslations("accountSettings.connectedApps");
  const tCommon = useTranslations("accountSettings");
  const [rows, setRows] = useState(apps);
  const [pendingId, setPendingId] = useState<number | null>(null);

  async function handleRevoke(clientId: number) {
    setPendingId(clientId);
    const result = await revokeOAuthConsent(clientId);
    setPendingId(null);
    if (result.ok) setRows((prev) => prev.filter((r) => r.clientId !== clientId));
  }

  return (
    <SettingsCard heading={t("heading")} description={t("description")}>
      {rows.length === 0 ? (
        <p className="text-[13.5px] text-neutral-500">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map((app) => (
            <div key={app.clientId} className="flex items-center gap-3 rounded-[10px] border border-neutral-800 px-4 py-3">
              <AppLogo logoUrl={app.logoUrl} name={app.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] font-medium text-neutral-100">{app.name}</p>
                <p className="mt-0.5 text-[12.5px] text-neutral-500">
                  {app.scopes.map((scope: OAuthScope) => t(`scope.${scope}`)).join(", ")} · <FormattedDate date={app.createdAt} mode="date" />
                </p>
              </div>
              <RevokeButton label={t("revoke")} confirmLabel={tCommon("confirmClick")} disabled={pendingId === app.clientId} onConfirm={() => handleRevoke(app.clientId)} />
            </div>
          ))}
        </div>
      )}
    </SettingsCard>
  );
}

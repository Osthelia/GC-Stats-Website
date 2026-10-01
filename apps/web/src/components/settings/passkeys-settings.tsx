/**
 * GC-Stats - passkeys-settings
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { signIn as signInWithPasskey } from "next-auth/webauthn";
import { useRouter } from "@/i18n/navigation";
import { deletePasskey } from "@/actions/account-settings";
import { PasskeyIcon } from "@/components/icons/brand-icons";
import { useConfirmClick } from "@/lib/use-confirm-click";
import { SettingsCard } from "./settings-card";

export type PasskeyRow = {
  credentialID: string;
  name: string | null;
  createdAt: string;
  lastUsedAt: string | null;
};

function DeleteButton({ label, confirmLabel, disabled, onConfirm }: { label: string; confirmLabel: string; disabled: boolean; onConfirm: () => void }) {
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

export function PasskeysSettings({
  passkeys,
  canDelete,
  userEmail,
  userName,
}: {
  passkeys: PasskeyRow[];
  canDelete: boolean;
  userEmail: string;
  userName: string | null;
}) {
  const t = useTranslations("accountSettings.passkeys");
  const tCommon = useTranslations("accountSettings");
  const locale = useLocale();
  const router = useRouter();
  const dateFormat = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" });

  const [rows, setRows] = useState(passkeys);
  const [addError, setAddError] = useState(false);
  const [deleteError, setDeleteError] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);

  async function handleAdd() {
    setAddError(false);
    setPending("add");
    try {
      const result = await signInWithPasskey("webauthn", {
        email: userEmail,
        name: userName ?? undefined,
        action: "register",
        redirect: false,
      });
      if (!result || result.error) {
        setAddError(true);
        setPending(null);
        return;
      }
    } catch {
      setAddError(true);
      setPending(null);
      return;
    }
    setPending(null);
    router.refresh();
  }

  async function handleDelete(credentialID: string) {
    setDeleteError((prev) => ({ ...prev, [credentialID]: "" }));
    setPending(credentialID);
    const result = await deletePasskey(credentialID);
    setPending(null);
    if (!result.ok) {
      setDeleteError((prev) => ({ ...prev, [credentialID]: result.error }));
      return;
    }
    setRows((prev) => prev.filter((p) => p.credentialID !== credentialID));
  }

  return (
    <SettingsCard heading={t("heading")} description={t("description")}>
      <div className="flex flex-col gap-2.5">
        {rows.length === 0 && <p className="text-[13.5px] text-neutral-500">{t("empty")}</p>}

        {rows.map((passkey) => (
          <div key={passkey.credentialID} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3 rounded-[10px] border border-neutral-800 px-4 py-3">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] bg-[#e4ae22]/12 text-[#e4ae22]">
                <PasskeyIcon className="h-[17px] w-[17px]" />
              </span>
              <div className="flex-1">
                <div className="text-[14.5px] font-medium text-neutral-100">{passkey.name || t("heading")}</div>
                <div className="text-[12.5px] text-neutral-500">
                  {t("createdAt", { date: dateFormat.format(new Date(passkey.createdAt)) })}
                  {" · "}
                  {passkey.lastUsedAt ? t("lastUsedAt", { date: dateFormat.format(new Date(passkey.lastUsedAt)) }) : t("neverUsed")}
                </div>
              </div>
              {canDelete && (
                <DeleteButton
                  label={t("delete")}
                  confirmLabel={tCommon("confirmClick")}
                  disabled={pending === passkey.credentialID}
                  onConfirm={() => handleDelete(passkey.credentialID)}
                />
              )}
            </div>
            {deleteError[passkey.credentialID] && (
              <p role="alert" className="text-[12.5px] text-[#e08585]">
                {t(`error.${deleteError[passkey.credentialID]}`)}
              </p>
            )}
          </div>
        ))}

        {addError && (
          <p role="alert" className="text-[13px] text-[#e08585]">
            {t("addError")}
          </p>
        )}

        <button
          type="button"
          onClick={handleAdd}
          disabled={pending === "add"}
          className="mt-1 flex items-center justify-center gap-2 self-start rounded-[9px] border border-neutral-700 px-4 py-2.5 text-[14px] font-medium text-neutral-200 transition-colors hover:border-neutral-600 hover:bg-[var(--gcs-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PasskeyIcon className="h-[16px] w-[16px]" />
          {t("add")}
        </button>
      </div>
    </SettingsCard>
  );
}

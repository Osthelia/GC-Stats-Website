/**
 * GC-Stats - account-danger-zone
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SettingsCard } from "./settings-card";
import { DeleteAccountDialog } from "./delete-account-dialog";

export function AccountDangerZone({ hasPassword }: { hasPassword: boolean }) {
  const t = useTranslations("accountSettings.dangerZone");
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <SettingsCard heading={t("heading")} description={t("description")}>
      <div className="flex flex-wrap items-center gap-3">
        <a
          href="/api/settings/account/export"
          download
          className="rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-4 py-2.5 text-[14px] font-medium text-neutral-200 transition-colors hover:bg-[var(--gcs-hover)]"
        >
          {t("export")}
        </a>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="rounded-[9px] px-4 py-2.5 text-[14px] font-medium text-[#e08585] transition-colors hover:bg-[#e08585]/10"
        >
          {t("delete")}
        </button>
      </div>
      {deleteOpen && <DeleteAccountDialog hasPassword={hasPassword} onClose={() => setDeleteOpen(false)} />}
    </SettingsCard>
  );
}

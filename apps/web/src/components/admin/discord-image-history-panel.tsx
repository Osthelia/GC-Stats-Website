/**
 * GC-Stats - discord-image-history-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import type { AdminDiscordImageDecisionRow } from "@/lib/admin-discord-image-reviews";

function UserLink({ id, username, fallback }: { id: string | null; username: string | null; fallback: string }) {
  if (!id) return <span className="text-foreground">{fallback}</span>;
  return (
    <Link href={`/admin/users/${id}`} className="text-foreground hover:underline">
      {username ?? fallback}
    </Link>
  );
}

export async function DiscordImageHistoryPanel({ rows, locale }: { rows: AdminDiscordImageDecisionRow[]; locale: string }) {
  const t = await getTranslations({ locale, namespace: "admin.moderation.images" });
  const format = await getFormatter({ locale });

  if (rows.length === 0) {
    return <div className="rounded-md border py-8 text-center text-sm text-muted-foreground">{t("history.empty")}</div>;
  }

  return (
    <div className="flex flex-col divide-y rounded-md border">
      {rows.map((row) => (
        <div key={row.id} className="flex flex-col gap-1.5 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            {row.decision === "verified" ? (
              <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                {t("history.verified")}
              </Badge>
            ) : (
              <Badge variant="outline" className="border-destructive/20 bg-destructive/10 text-destructive">
                {t("history.sanctioned")}
              </Badge>
            )}
            <Badge variant="outline">{t(`event.${row.event}`)}</Badge>
            {row.sanctions.map((sanction) => (
              <Badge key={sanction} variant="outline">
                {t(`history.sanction.${sanction}`)}
              </Badge>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">{format.dateTime(new Date(row.decidedAt), { dateStyle: "medium", timeStyle: "short" })}</span>
          </div>
          <p className="text-muted-foreground">
            {t("server")} <span className="font-mono text-foreground">{row.guildId}</span>
          </p>
          <p className="text-muted-foreground">
            {t("editor")} <UserLink id={row.editorId} username={row.editorUsername} fallback={t("unknownUser")} />
            {row.editorDiscordId && <span className="ml-1 font-mono text-xs">({row.editorDiscordId})</span>}
          </p>
          <p className="text-muted-foreground">
            {t("history.moderator")} <UserLink id={row.moderatorId} username={row.moderatorUsername} fallback={t("unknownUser")} />
          </p>
          {row.reason && (
            <p className="text-muted-foreground">
              {t("history.reason")} <span className="text-foreground">{row.reason}</span>
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

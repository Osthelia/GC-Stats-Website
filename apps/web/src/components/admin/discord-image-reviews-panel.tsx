/**
 * GC-Stats - discord-image-reviews-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ExternalLink, Gavel, ImageOff, Loader2, ShieldCheck } from "lucide-react";
import { useRouter, Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DiscordImageSanctionDialog } from "@/components/admin/discord-image-sanction-dialog";
import { verifyDiscordImage } from "@/actions/admin-discord-images";
import type { AdminDiscordImageRow } from "@/lib/admin-discord-image-reviews";

/** Alert image rendered on demand: a spinner while it renders, a placeholder when it fails. */
function ReviewImage({ src, alt }: { src: string; alt: string }) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  return (
    <div className="relative aspect-video w-full bg-muted/30">
      {state === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      )}
      {state === "failed" ? (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <ImageOff className="size-5" />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="size-full object-contain" onLoad={() => setState("ready")} onError={() => setState("failed")} />
      )}
    </div>
  );
}

export function DiscordImageReviewsPanel({ rows, canManage }: { rows: AdminDiscordImageRow[]; canManage: boolean }) {
  const t = useTranslations("admin.moderation.images");
  const format = useFormatter();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [sanctioning, setSanctioning] = useState<AdminDiscordImageRow | null>(null);

  function handleVerify(row: AdminDiscordImageRow) {
    setVerifyingId(row.id);
    startTransition(async () => {
      const result = await verifyDiscordImage(row.id);
      setVerifyingId(null);
      if (!result.ok) {
        toast.error(t("error.notFound"));
        router.refresh();
        return;
      }
      router.refresh();
      toast.success(t("verifySuccess"));
    });
  }

  if (rows.length === 0) {
    return <div className="rounded-md border py-8 text-center text-sm text-muted-foreground">{t("empty")}</div>;
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <Card key={row.id} size="sm">
            <CardContent className="flex flex-col gap-3">
              <a href={row.imageUrl} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-md border bg-muted/30" aria-label={t("openImage")}>
                <ReviewImage src={row.imageUrl} alt={t("imageAlt")} />
                <span className="absolute right-2 top-2 rounded-md bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <ExternalLink className="size-3.5" />
                </span>
              </a>

              <div className="flex flex-col gap-1 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{t(`event.${row.event}`)}</Badge>
                  {row.guildBlacklisted && (
                    <Badge variant="outline" className="border-destructive/20 bg-destructive/10 text-destructive">
                      {t("guildBlacklisted")}
                    </Badge>
                  )}
                  {row.userBlacklisted && (
                    <Badge variant="outline" className="border-destructive/20 bg-destructive/10 text-destructive">
                      {t("userBlacklisted")}
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">
                  {t("server")} <span className="font-mono text-foreground">{row.guildId}</span>
                </p>
                <p className="text-muted-foreground">
                  {t("editor")}{" "}
                  {row.editorId ? (
                    <Link href={`/admin/users/${row.editorId}`} className="text-foreground hover:underline">
                      {row.editorUsername ?? t("unknownUser")}
                    </Link>
                  ) : (
                    <span className="text-foreground">{t("unknownUser")}</span>
                  )}
                  {row.editorDiscordId && <span className="ml-1 font-mono text-xs">({row.editorDiscordId})</span>}
                </p>
                <p className="text-xs text-muted-foreground">{format.dateTime(new Date(row.editedAt), { dateStyle: "medium", timeStyle: "short" })}</p>
              </div>

              {canManage && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" disabled={isPending} onClick={() => handleVerify(row)}>
                    {verifyingId === row.id ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                    {t("verifyButton")}
                  </Button>
                  <Button size="sm" variant="destructive" className="flex-1" disabled={isPending} onClick={() => setSanctioning(row)}>
                    <Gavel className="size-4" />
                    {t("sanctionButton")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <DiscordImageSanctionDialog row={sanctioning} open={sanctioning !== null} onOpenChange={(open) => !open && setSanctioning(null)} />
    </>
  );
}

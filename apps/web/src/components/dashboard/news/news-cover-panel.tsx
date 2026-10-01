/**
 * GC-Stats - news-cover-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2Icon, StarIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { uploadDashboardNewsImage, setDashboardNewsCover, deleteDashboardNewsImage } from "@/actions/dashboard-news";

export type NewsCoverImage = { id: string; url: string };

export function NewsCoverPanel({
  organizationId,
  newsId,
  images,
  coverUrl,
  onImagesChange,
  onCoverChange,
}: {
  organizationId: number | null;
  newsId: number;
  images: NewsCoverImage[];
  coverUrl: string | null;
  onImagesChange: (images: NewsCoverImage[]) => void;
  onCoverChange: (url: string | null) => void;
}) {
  const t = useTranslations("dashboard.news.editor");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    startTransition(async () => {
      const result = await uploadDashboardNewsImage(organizationId, newsId, formData);
      if (!result.ok) {
        toast.error(t(`error.${result.error}`));
        return;
      }
      onImagesChange([...images, { id: result.id, url: result.url }]);
    });
  }

  function handleSetCover(imageId: string, url: string) {
    setBusyId(imageId);
    startTransition(async () => {
      const result = await setDashboardNewsCover(organizationId, newsId, imageId);
      setBusyId(null);
      if (!result.ok) {
        toast.error(t("error.notFound"));
        return;
      }
      onCoverChange(url);
    });
  }

  function handleDelete(imageId: string) {
    setBusyId(imageId);
    startTransition(async () => {
      const result = await deleteDashboardNewsImage(organizationId, newsId, imageId);
      setBusyId(null);
      setConfirmDeleteId(null);
      if (!result.ok) {
        toast.error(t("error.notFound"));
        return;
      }
      onImagesChange(images.filter((img) => img.id !== imageId));
      if (images.find((img) => img.id === imageId)?.url === coverUrl) onCoverChange(null);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">{t("coverUploadHint")}</p>

      {images.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("coverNoneYet")}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((img) => {
            const isCover = img.url === coverUrl;
            const busy = busyId === img.id;
            return (
              <div key={img.id} className={cn("group relative overflow-hidden rounded-lg border", isCover && "border-primary ring-2 ring-primary/30")}>
                <div className="relative aspect-video w-full bg-muted">
                  <Image src={img.url} alt="" fill sizes="200px" className="object-cover" unoptimized />
                </div>
                {isCover && (
                  <span className="absolute top-1 left-1 flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                    <StarIcon className="size-2.5 fill-current" />
                    {t("coverIsCoverBadge")}
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/60 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {!isCover && (
                    <button
                      type="button"
                      title={t("coverSetAsCoverButton")}
                      disabled={busy}
                      onClick={() => handleSetCover(img.id, img.url)}
                      className="flex size-6 items-center justify-center rounded text-white hover:bg-white/20 disabled:opacity-50"
                    >
                      {busy ? <Loader2Icon className="size-3.5 animate-spin" /> : <StarIcon className="size-3.5" />}
                    </button>
                  )}
                  <button
                    type="button"
                    title={t("coverDeleteButton")}
                    disabled={busy}
                    onClick={() => setConfirmDeleteId(img.id)}
                    className="ml-auto flex size-6 items-center justify-center rounded text-white hover:bg-white/20 disabled:opacity-50"
                  >
                    <Trash2Icon className="size-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => fileInputRef.current?.click()} className="w-fit">
        {isPending ? <Loader2Icon className="size-3.5 animate-spin" /> : <UploadIcon className="size-3.5" />}
        {t("coverUploadButton")}
      </Button>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
        title={t("coverDeleteTitle")}
        description={t("coverDeleteConfirm")}
        confirmLabel={t("coverDeleteButton")}
        cancelLabel={t("coverDeleteCancel")}
        onConfirm={() => confirmDeleteId !== null && handleDelete(confirmDeleteId)}
        isPending={isPending}
        destructive
      />
    </div>
  );
}

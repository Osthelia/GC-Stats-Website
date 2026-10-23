/**
 * GC-Stats - image-crop-dialog
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import { useTranslations } from "next-intl";
import { Loader2, Maximize2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { exportCrop, type Area, type ImagePreset } from "@/lib/image-upload";

export type ImageFieldVariant = "app" | "public";

/** The public site and the dashboard/admin use different design tokens, the logic is shared. */
export const IMAGE_FIELD_STYLES = {
  app: {
    content: "sm:max-w-xl",
    stage: "bg-muted",
    text: "text-muted-foreground",
    error: "text-destructive",
    iconButton: "border border-border bg-background text-foreground hover:bg-muted",
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    secondary: "border border-border bg-background text-foreground hover:bg-muted",
  },
  public: {
    content: "rounded-2xl border border-neutral-800 bg-[var(--gcs-surface-3)] text-neutral-50 shadow-[0_22px_50px_rgba(0,0,0,.72)] ring-0 sm:max-w-xl",
    stage: "bg-[var(--gcs-surface-2)]",
    text: "text-neutral-400",
    error: "text-[#e08585]",
    iconButton: "border border-neutral-700 bg-[var(--gcs-surface-2)] text-neutral-200 hover:border-[#e4ae22]/60",
    primary: "bg-[#e4ae22] text-[#0e0e0e] hover:bg-[#c9981d] active:bg-[#b3860f]",
    secondary: "border border-neutral-700 bg-[var(--gcs-surface-2)] text-neutral-200 hover:border-[#e4ae22]/60",
  },
} as const;

const BUTTON_BASE = "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-all active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50";
const MAX_ZOOM = 4;
/** Smallest the image gets relative to the exact fit, so the margin stays usable. */
const PADDING_FIT_RATIO = 0.25;
const ZOOM_STEP = 1.25;
/** Fallback when no open animation runs (reduced motion), the cropper must still mount. */
const OPEN_ANIMATION_FALLBACK_MS = 400;

/** Crop frame with zoom, and a zoom out that adds a transparent margin when the preset allows it. */
export function ImageCropDialog({
  src,
  fileName,
  preset,
  variant,
  onCancel,
  onConfirm,
}: {
  src: string;
  fileName: string;
  preset: ImagePreset;
  variant: ImageFieldVariant;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}) {
  const t = useTranslations("imageUpload");
  const st = IMAGE_FIELD_STYLES[variant];
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [fitZoom, setFitZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [ready, setReady] = useState(false);
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [loaded, setLoaded] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tooSmall, setTooSmall] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), OPEN_ANIMATION_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, []);

  const minZoom = preset.allowPadding ? Math.min(1, fitZoom) * PADDING_FIT_RATIO : 1;

  async function handleConfirm() {
    if (!area) return;
    // Zooming in can leave fewer pixels than the server accepts, the transparent margin does not count.
    const visibleWidth = Math.min(area.x + area.width, natural.width) - Math.max(area.x, 0);
    const visibleHeight = Math.min(area.y + area.height, natural.height) - Math.max(area.y, 0);
    const small = Math.min(visibleWidth, visibleHeight) < preset.minSide;
    setTooSmall(small);
    if (small) return;
    setExporting(true);
    setFailed(false);
    try {
      onConfirm(await exportCrop(src, area, preset, fileName));
    } catch (error) {
      console.error("[image-upload] crop export failed", error);
      setFailed(true);
      setExporting(false);
    }
  }

  /** Frame glued to the largest side of the image, no margin. */
  function fitWhole() {
    setCrop({ x: 0, y: 0 });
    setZoom(Math.min(1, fitZoom));
  }

  function reset() {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }

  const iconButton = cn(BUTTON_BASE, "size-8 p-0", st.iconButton);

  return (
    <Dialog open onOpenChange={(next) => !next && !exporting && onCancel()}>
      <DialogContent
        className={st.content}
        // The cropper measures its container once at mount, so it waits for the open scale animation to end.
        onAnimationEnd={(e) => e.target === e.currentTarget && setReady(true)}
      >
        <DialogHeader>
          <DialogTitle>{t("cropTitle")}</DialogTitle>
          <DialogDescription className={st.text}>{preset.allowPadding ? t("cropDescriptionPadding") : t("cropDescription")}</DialogDescription>
        </DialogHeader>

        <div className={cn("relative h-72 w-full overflow-hidden rounded-lg sm:h-80", st.stage)}>
          {ready && (
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={preset.aspect}
            minZoom={minZoom}
            maxZoom={MAX_ZOOM}
            restrictPosition={!preset.allowPadding}
            objectFit="contain"
            showGrid
            onCropChange={setCrop}
            onZoomChange={(z) => {
              setZoom(z);
              setTooSmall(false);
            }}
            onCropComplete={(_, pixels) => setArea(pixels)}
            onMediaLoaded={(media) => {
              setNatural({ width: media.naturalWidth, height: media.naturalHeight });
              const imageRatio = media.naturalWidth / media.naturalHeight;
              setFitZoom(Math.min(imageRatio / preset.aspect, preset.aspect / imageRatio));
              setLoaded(true);
            }}
          />
          )}
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className={cn("size-6 animate-spin", st.text)} />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button type="button" aria-label={t("zoomOut")} title={t("zoomOut")} className={iconButton} disabled={exporting} onClick={() => setZoom((z) => Math.max(minZoom, z / ZOOM_STEP))}>
            <ZoomOut className="size-4" />
          </button>
          <Slider className="min-w-0 flex-1" aria-label={t("zoom")} min={Math.log(minZoom)} max={Math.log(MAX_ZOOM)} step={0.01} value={Math.log(Math.min(MAX_ZOOM, Math.max(zoom, minZoom)))} onValueChange={(v) => setZoom(Math.exp(v))} disabled={exporting || !loaded} />
          <button type="button" aria-label={t("zoomIn")} title={t("zoomIn")} className={iconButton} disabled={exporting} onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * ZOOM_STEP))}>
            <ZoomIn className="size-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {preset.allowPadding && (
            <button type="button" className={cn(BUTTON_BASE, st.secondary)} disabled={exporting || !loaded} onClick={fitWhole}>
              <Maximize2 className="size-4" />
              {t("fit")}
            </button>
          )}
          <button type="button" className={cn(BUTTON_BASE, st.secondary)} disabled={exporting} onClick={reset}>
            <RotateCcw className="size-4" />
            {t("reset")}
          </button>
        </div>

        {tooSmall && (
          <p role="alert" className={cn("text-xs", st.error)}>
            {t("error.tooSmall", { min: preset.minSide })}
          </p>
        )}
        {failed && (
          <p role="alert" className={cn("text-xs", st.error)}>
            {t("exportFailed")}
          </p>
        )}

        <DialogFooter>
          <button type="button" className={cn(BUTTON_BASE, st.secondary)} disabled={exporting} onClick={onCancel}>
            {t("cancel")}
          </button>
          <button type="button" className={cn(BUTTON_BASE, st.primary)} disabled={exporting || !area || !loaded} onClick={handleConfirm}>
            {exporting && <Loader2 className="size-4 animate-spin" />}
            {exporting ? t("applying") : t("apply")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

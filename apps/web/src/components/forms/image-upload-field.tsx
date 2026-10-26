/**
 * GC-Stats - image-upload-field
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ImageOff, Loader2, Upload } from "lucide-react";
import { IMAGE_FIELD_STYLES, type ImageFieldVariant } from "@/components/forms/image-crop-dialog";
import { useImagePicker } from "@/components/forms/use-image-picker";
import { cn } from "@/lib/utils";
import { IMAGE_PRESETS, formatLabel, type ImagePresetName } from "@/lib/image-upload";

/** Requirements list, also used next to buttons that upload without the field. */
export function ImageConstraints({ preset: presetName, variant = "app" }: { preset: ImagePresetName; variant?: ImageFieldVariant }) {
  const t = useTranslations("imageUpload");
  const st = IMAGE_FIELD_STYLES[variant];
  const preset = IMAGE_PRESETS[presetName];
  const constraints = [
    t("constraintFormats", { formats: preset.accept.map(formatLabel).join(", ") }),
    t("constraintWeight", { max: preset.maxMb }),
    t("constraintMinSide", { min: preset.minSide }),
    t("constraintRatio", { ratio: preset.ratioLabel }),
    t("constraintOutput", { max: preset.outputMax }),
  ];

  return (
    <div className={cn("flex flex-col gap-0.5 text-xs", st.text)}>
      <span className="font-medium">{t("constraintsTitle")}</span>
      <ul className="list-disc pl-4">
        {constraints.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

const BUTTON = "inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50";

/**
 * Single image field shared by every upload form: states the constraints, checks the file,
 * then lets the user crop and zoom before it is handed over as a regular `File`.
 */
export function ImageUploadField({
  id,
  preset: presetName,
  variant = "app",
  file,
  onChange,
  error,
  disabled,
}: {
  id: string;
  preset: ImagePresetName;
  variant?: ImageFieldVariant;
  file: File | null;
  onChange: (file: File | null) => void;
  /** Server side error, shown under the field next to any local one. */
  error?: string;
  disabled?: boolean;
}) {
  const t = useTranslations("imageUpload");
  const st = IMAGE_FIELD_STYLES[variant];
  const picker = useImagePicker({ preset: presetName, variant, onPick: onChange });
  const { preset } = picker;
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    setPreviewFailed(false);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // The originals are dropped once the parent clears the value.
  const { reset } = picker;
  useEffect(() => {
    if (!file) reset();
  }, [file, reset]);

  const formats = preset.accept.map(formatLabel).join(", ");
  const errorText = picker.error ? t(`error.${picker.error}`, { max: preset.maxMb, min: preset.minSide, formats }) : error;

  return (
    <div className="flex flex-col gap-2">
      {file && preview ? (
        <div className={cn("flex items-center gap-3 rounded-lg border p-2", variant === "public" ? "border-neutral-800" : "border-border")}>
          {previewFailed ? (
            <div className={cn("flex size-16 shrink-0 items-center justify-center rounded-md", st.stage)}>
              <ImageOff className={cn("size-5", st.text)} />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className={cn("size-16 shrink-0 rounded-md object-contain", st.stage)} onError={() => setPreviewFailed(true)} />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className={cn("truncate text-xs", st.text)}>{file.name}</span>
            <div className="flex flex-wrap gap-1.5">
              {picker.canRecrop && (
                <button type="button" disabled={disabled} className={cn(BUTTON, st.secondary)} onClick={picker.recrop}>
                  {t("editCrop")}
                </button>
              )}
              <button type="button" disabled={disabled} className={cn(BUTTON, st.secondary)} onClick={picker.openFilePicker}>
                {t("replace")}
              </button>
              <button
                type="button"
                disabled={disabled}
                className={cn(BUTTON, st.secondary, st.error)}
                onClick={() => {
                  picker.clearError();
                  onChange(null);
                }}
              >
                {t("remove")}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          id={id}
          disabled={disabled || picker.checking}
          aria-invalid={!!errorText}
          onClick={picker.openFilePicker}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            setDragging(false);
            if (!disabled) picker.handleDrop(e);
          }}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm transition-all active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50",
            variant === "public"
              ? dragging ? "border-[#e4ae22] bg-[#e4ae22]/10" : "border-neutral-700 bg-[var(--gcs-surface-2)] hover:border-[#e4ae22]/60"
              : dragging ? "border-primary bg-primary/10" : "border-border bg-muted/40 hover:border-primary/60",
            errorText && (variant === "public" ? "border-[#e08585]" : "border-destructive")
          )}
        >
          {picker.checking ? <Loader2 className={cn("size-5 animate-spin", st.text)} /> : <Upload className={cn("size-5", st.text)} />}
          <span className="font-medium">{picker.checking ? t("checking") : t("dropzone")}</span>
          <span className={cn("text-xs", st.text)}>{t("dropzoneHint")}</span>
        </button>
      )}

      {picker.element}

      {errorText && (
        <p role="alert" className={cn("text-xs", st.error)}>
          {errorText}
        </p>
      )}

      <ImageConstraints preset={presetName} variant={variant} />
    </div>
  );
}

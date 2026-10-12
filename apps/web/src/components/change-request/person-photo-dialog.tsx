/**
 * GC-Stats - person-photo-dialog
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link } from "@/i18n/navigation";
import { PHOTO_ACCEPT, PHOTO_MAX_MB, PHOTO_MIN_SIDE, type PhotoConsent } from "@/lib/change-request-fields";

const primaryButton =
  "rounded-[9px] bg-[#e4ae22] px-5 py-2.5 text-[14px] font-semibold text-[#0e0e0e] transition-all hover:bg-[#c9981d] active:scale-[0.97] active:bg-[#b3860f] disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton =
  "rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-4 py-2.5 text-[14px] font-semibold text-neutral-200 transition-all hover:border-[#e4ae22]/60 active:scale-[0.97]";

const COMMON_POINTS = ["legalRights", "legalLicense", "legalThirdParty", "legalMinor", "legalWithdraw"] as const;
const CAPACITIES: PhotoConsent[] = ["self", "authorized"];
const RULES = ["ruleFace", "rulePose", "ruleJersey"] as const;

function readDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

function RuleItem({ children, muted }: { children: string; muted?: boolean }) {
  return (
    <li className="flex gap-2">
      <span className={`mt-[7px] h-1.5 w-1.5 flex-none rounded-full ${muted ? "bg-neutral-600" : "bg-[#e4ae22]"}`} />
      {children}
    </li>
  );
}

/** Two steps: the rights text must be accepted before the upload field and the photo rules appear. */
export function PersonPhotoDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: (file: File, consent: PhotoConsent) => void }) {
  const t = useTranslations("suggestEdit.logo.photo");
  const tError = useTranslations("suggestEdit.error");
  const inputRef = useRef<HTMLInputElement>(null);
  const [capacity, setCapacity] = useState<PhotoConsent | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [step, setStep] = useState<"consent" | "upload">("consent");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function handleFile(next: File | null) {
    if (!next) return;
    setError(null);
    setFile(null);
    setPreview(null);
    if (!PHOTO_ACCEPT.split(",").includes(next.type)) return setError("invalidType");
    if (next.size > PHOTO_MAX_MB * 1024 * 1024) return setError("tooLarge");

    setChecking(true);
    const dims = await readDimensions(next);
    setChecking(false);
    if (!dims) return setError("invalidImage");
    if (Math.min(dims.width, dims.height) < PHOTO_MIN_SIDE) return setError("tooSmall");

    setFile(next);
    setPreview(URL.createObjectURL(next));
  }

  function handleDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    setDragging(false);
    void handleFile(e.dataTransfer.files?.[0] ?? null);
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="rounded-2xl border border-neutral-800 bg-[var(--gcs-surface-3)] p-6 text-neutral-50 shadow-[0_22px_50px_rgba(0,0,0,.72)] ring-0 sm:max-w-[760px]">
        {step === "consent" ? (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle className="text-[16px] font-semibold text-neutral-50">{t("legalTitle")}</DialogTitle>
            </DialogHeader>
            <p className="text-[13.5px] leading-relaxed text-neutral-400">{t("legalLead")}</p>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 flex items-center gap-1 text-[13px] text-neutral-400">
                {t("capacityLabel")} <span className="text-[#e08585]">*</span>
              </legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {CAPACITIES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={capacity === value}
                    onClick={() => {
                      setCapacity(value);
                      setAccepted(false);
                    }}
                    className={`flex flex-col gap-1 rounded-[9px] border p-3 text-left transition-all active:scale-[0.99] ${
                      capacity === value ? "border-[#e4ae22] bg-[#e4ae22]/10" : "border-neutral-700 bg-[var(--gcs-surface-2)] hover:border-[#e4ae22]/60"
                    }`}
                  >
                    <span className="text-[13.5px] font-semibold text-neutral-100">{t(`capacity.${value}`)}</span>
                    <span className="text-[12px] leading-snug text-neutral-500">{t(`capacityHint.${value}`)}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            {capacity && (
              <>
                <ol className="flex list-decimal flex-col gap-2.5 pl-5 text-[13.5px] leading-relaxed text-neutral-300 marker:text-[#e4ae22]">
                  <li>{t(`legalCapacity.${capacity}`)}</li>
                  {COMMON_POINTS.map((key) => (
                    <li key={key}>{t(key)}</li>
                  ))}
                </ol>
                <p className="text-[12px] leading-relaxed text-neutral-500">
                  {t.rich("legalLinks", {
                    privacy: (chunks) => (
                      <Link href="/privacy" target="_blank" className="underline transition-colors hover:text-neutral-300">
                        {chunks}
                      </Link>
                    ),
                    takedown: (chunks) => (
                      <Link href="/takedown" target="_blank" className="underline transition-colors hover:text-neutral-300">
                        {chunks}
                      </Link>
                    ),
                  })}
                </p>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-[9px] border border-neutral-800 bg-[var(--gcs-surface-2)] p-3 text-[13.5px] text-neutral-200">
                  <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 h-4 w-4 flex-none accent-[#e4ae22]" />
                  <span>
                    {t(`legalCheckbox.${capacity}`)} <span className="text-[#e08585]">*</span>
                  </span>
                </label>
              </>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={onClose} className={secondaryButton}>
                {t("cancel")}
              </button>
              <button type="button" disabled={!capacity || !accepted} onClick={() => setStep("upload")} className={primaryButton}>
                {t("accept")}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle className="text-[16px] font-semibold text-neutral-50">{t("uploadTitle")}</DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  className={`flex aspect-square w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed p-4 text-center transition-all active:scale-[0.99] ${
                    error ? "border-[#e08585]" : dragging ? "border-[#e4ae22] bg-[#e4ae22]/10" : "border-neutral-700 bg-[var(--gcs-surface-2)] hover:border-[#e4ae22]/60"
                  }`}
                >
                  {checking ? (
                    <span className="text-[13px] text-neutral-400">{t("checking")}</span>
                  ) : preview ? (
                    <Image src={preview} alt="" width={320} height={320} className="h-full w-full rounded-lg object-contain" unoptimized />
                  ) : (
                    <>
                      <span className="text-[14px] font-semibold text-neutral-200">{t("dropzone")}</span>
                      <span className="text-[12px] text-neutral-500">{t("dropzoneHint")}</span>
                    </>
                  )}
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept={PHOTO_ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    void handleFile(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
                {file && !error && <span className="truncate text-[12.5px] text-neutral-400">{file.name}</span>}
                {error && (
                  <span role="alert" className="text-[12.5px] text-[#e08585]">
                    {tError(error)}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-neutral-500">{t("rulesTitle")}</h3>
                <ul className="flex flex-col gap-2 text-[13.5px] leading-relaxed text-neutral-300">
                  {RULES.map((key) => (
                    <RuleItem key={key}>{t(key)}</RuleItem>
                  ))}
                </ul>
                <h3 className="mt-1 text-[12px] font-semibold uppercase tracking-wide text-neutral-500">{t("technicalTitle")}</h3>
                <ul className="flex flex-col gap-2 text-[13.5px] leading-relaxed text-neutral-300">
                  <RuleItem muted>{t("ruleFormat")}</RuleItem>
                  <RuleItem muted>{t("ruleWeight", { max: PHOTO_MAX_MB })}</RuleItem>
                  <RuleItem muted>{t("ruleSize", { min: PHOTO_MIN_SIDE })}</RuleItem>
                </ul>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={onClose} className={secondaryButton}>
                {t("cancel")}
              </button>
              <button type="button" disabled={!file || !!error || checking} onClick={() => file && capacity && onConfirm(file, capacity)} className={primaryButton}>
                {t("confirm")}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

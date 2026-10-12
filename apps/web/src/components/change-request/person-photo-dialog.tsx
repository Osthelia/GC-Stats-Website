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

/** The public site and the dashboard use different design tokens, the logic and texts are shared. */
const STYLES = {
  public: {
    content: "rounded-2xl border border-neutral-800 bg-[var(--gcs-surface-3)] p-6 text-neutral-50 shadow-[0_22px_50px_rgba(0,0,0,.72)] ring-0 sm:max-w-[760px]",
    title: "text-[16px] font-semibold text-neutral-50",
    lead: "text-[13.5px] leading-relaxed text-neutral-400",
    legend: "text-neutral-400",
    list: "text-neutral-300 marker:text-[#e4ae22]",
    small: "text-neutral-500",
    link: "hover:text-neutral-300",
    card: "border-neutral-800 bg-[var(--gcs-surface-2)] text-neutral-200",
    option: "border-neutral-700 bg-[var(--gcs-surface-2)] hover:border-[#e4ae22]/60",
    optionOn: "border-[#e4ae22] bg-[#e4ae22]/10",
    optionTitle: "text-neutral-100",
    drop: "border-neutral-700 bg-[var(--gcs-surface-2)] hover:border-[#e4ae22]/60",
    dropOn: "border-[#e4ae22] bg-[#e4ae22]/10",
    dropTitle: "text-neutral-200",
    fileName: "text-neutral-400",
    error: "text-[#e08585]",
    errorBorder: "border-[#e08585]",
    bullet: "bg-[#e4ae22]",
    bulletMuted: "bg-neutral-600",
    body: "text-neutral-300",
    accent: "accent-[#e4ae22]",
    primary: "bg-[#e4ae22] text-[#0e0e0e] hover:bg-[#c9981d] active:bg-[#b3860f]",
    secondary: "border border-neutral-700 bg-[var(--gcs-surface-2)] text-neutral-200 hover:border-[#e4ae22]/60",
  },
  dashboard: {
    content: "sm:max-w-[760px]",
    title: "text-base font-semibold",
    lead: "text-sm leading-relaxed text-muted-foreground",
    legend: "text-muted-foreground",
    list: "text-foreground/80 marker:text-primary",
    small: "text-muted-foreground",
    link: "hover:text-foreground",
    card: "border-border bg-muted/40 text-foreground",
    option: "border-border bg-muted/40 hover:border-primary/60",
    optionOn: "border-primary bg-primary/10",
    optionTitle: "text-foreground",
    drop: "border-border bg-muted/40 hover:border-primary/60",
    dropOn: "border-primary bg-primary/10",
    dropTitle: "text-foreground",
    fileName: "text-muted-foreground",
    error: "text-destructive",
    errorBorder: "border-destructive",
    bullet: "bg-primary",
    bulletMuted: "bg-muted-foreground/50",
    body: "text-foreground/80",
    accent: "accent-primary",
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    secondary: "border border-border bg-background text-foreground hover:bg-muted",
  },
} as const;

type Styles = (typeof STYLES)[keyof typeof STYLES];

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

function RuleItem({ children, muted, styles }: { children: string; muted?: boolean; styles: Styles }) {
  return (
    <li className="flex gap-2">
      <span className={`mt-[7px] h-1.5 w-1.5 flex-none rounded-full ${muted ? styles.bulletMuted : styles.bullet}`} />
      {children}
    </li>
  );
}

/** Two steps: the rights text must be accepted before the upload field and the photo rules appear. */
export function PersonPhotoDialog({
  variant = "public",
  onClose,
  onConfirm,
}: {
  variant?: keyof typeof STYLES;
  onClose: () => void;
  onConfirm: (file: File, consent: PhotoConsent) => void;
}) {
  const st = STYLES[variant];
  const primaryButton = `rounded-[9px] px-5 py-2.5 text-[14px] font-semibold transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${st.primary}`;
  const secondaryButton = `rounded-[9px] px-4 py-2.5 text-[14px] font-semibold transition-all active:scale-[0.97] ${st.secondary}`;
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
      <DialogContent className={st.content}>
        {step === "consent" ? (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle className={st.title}>{t("legalTitle")}</DialogTitle>
            </DialogHeader>
            <p className={st.lead}>{t("legalLead")}</p>

            <fieldset className="flex flex-col gap-2">
              <legend className={`mb-1.5 flex items-center gap-1 text-[13px] ${st.legend}`}>
                {t("capacityLabel")} <span className={st.error}>*</span>
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
                    className={`flex flex-col gap-1 rounded-[9px] border p-3 text-left transition-all active:scale-[0.99] ${capacity === value ? st.optionOn : st.option}`}
                  >
                    <span className={`text-[13.5px] font-semibold ${st.optionTitle}`}>{t(`capacity.${value}`)}</span>
                    <span className={`text-[12px] leading-snug ${st.small}`}>{t(`capacityHint.${value}`)}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            {capacity && (
              <>
                <ol className={`flex list-decimal flex-col gap-2.5 pl-5 text-[13.5px] leading-relaxed ${st.list}`}>
                  <li>{t(`legalCapacity.${capacity}`)}</li>
                  {COMMON_POINTS.map((key) => (
                    <li key={key}>{t(key)}</li>
                  ))}
                </ol>
                <p className={`text-[12px] leading-relaxed ${st.small}`}>
                  {t.rich("legalLinks", {
                    privacy: (chunks) => (
                      <Link href="/privacy" target="_blank" className={`underline transition-colors ${st.link}`}>
                        {chunks}
                      </Link>
                    ),
                    takedown: (chunks) => (
                      <Link href="/takedown" target="_blank" className={`underline transition-colors ${st.link}`}>
                        {chunks}
                      </Link>
                    ),
                  })}
                </p>
                <label className={`flex cursor-pointer items-start gap-2.5 rounded-[9px] border p-3 text-[13.5px] ${st.card}`}>
                  <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className={`mt-0.5 h-4 w-4 flex-none ${st.accent}`} />
                  <span>
                    {t(`legalCheckbox.${capacity}`)} <span className={st.error}>*</span>
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
              <DialogTitle className={st.title}>{t("uploadTitle")}</DialogTitle>
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
                    error ? st.errorBorder : dragging ? st.dropOn : st.drop
                  }`}
                >
                  {checking ? (
                    <span className={`text-[13px] ${st.fileName}`}>{t("checking")}</span>
                  ) : preview ? (
                    <Image src={preview} alt="" width={320} height={320} className="h-full w-full rounded-lg object-contain" unoptimized />
                  ) : (
                    <>
                      <span className={`text-[14px] font-semibold ${st.dropTitle}`}>{t("dropzone")}</span>
                      <span className={`text-[12px] ${st.small}`}>{t("dropzoneHint")}</span>
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
                {file && !error && <span className={`truncate text-[12.5px] ${st.fileName}`}>{file.name}</span>}
                {error && (
                  <span role="alert" className={`text-[12.5px] ${st.error}`}>
                    {tError(error)}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <h3 className={`text-[12px] font-semibold uppercase tracking-wide ${st.small}`}>{t("rulesTitle")}</h3>
                <ul className={`flex flex-col gap-2 text-[13.5px] leading-relaxed ${st.body}`}>
                  {RULES.map((key) => (
                    <RuleItem key={key} styles={st}>{t(key)}</RuleItem>
                  ))}
                </ul>
                <h3 className={`mt-1 text-[12px] font-semibold uppercase tracking-wide ${st.small}`}>{t("technicalTitle")}</h3>
                <ul className={`flex flex-col gap-2 text-[13.5px] leading-relaxed ${st.body}`}>
                  <RuleItem muted styles={st}>{t("ruleFormat")}</RuleItem>
                  <RuleItem muted styles={st}>{t("ruleWeight", { max: PHOTO_MAX_MB })}</RuleItem>
                  <RuleItem muted styles={st}>{t("ruleSize", { min: PHOTO_MIN_SIDE })}</RuleItem>
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

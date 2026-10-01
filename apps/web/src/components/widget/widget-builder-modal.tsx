/**
 * GC-Stats - widget-builder-modal
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function WidgetBuilderModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const t = useTranslations("widget");
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    focusable?.[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 backdrop-blur-sm" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-xl border border-neutral-800 p-6 shadow-2xl"
        style={{ background: "var(--gcs-surface-2)" }}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-black tracking-widest text-neutral-50 uppercase">{title}</h2>
          <button type="button" onClick={onClose} aria-label={t("close")} className="text-neutral-500 transition-colors hover:text-neutral-50">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

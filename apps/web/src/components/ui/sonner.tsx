"use client"

import { useEffect } from "react"
import { useTheme } from "next-themes"
import { useTranslations } from "next-intl"
import { toast, Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const TOAST_DURATION_MS = 4000

// Sonner met son timer en pause quand l'onglet est masqué : on ferme nous même après la durée
function useForcedToastExpiry() {
  useEffect(() => {
    const firstSeen = new Map<string | number, number>()
    const timer = setInterval(() => {
      const now = Date.now()
      const live = new Set<string | number>()
      for (const item of toast.getToasts()) {
        if (!("type" in item) || item.type === "loading") continue
        live.add(item.id)
        const seen = firstSeen.get(item.id) ?? now
        firstSeen.set(item.id, seen)
        if (now - seen >= TOAST_DURATION_MS + 500) toast.dismiss(item.id)
      }
      for (const id of firstSeen.keys()) if (!live.has(id)) firstSeen.delete(id)
    }, 500)
    return () => clearInterval(timer)
  }, [])
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  const t = useTranslations("toast")
  useForcedToastExpiry()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // Un seul toast visible à la fois, pas d'empilement
      visibleToasts={1}
      duration={TOAST_DURATION_MS}
      closeButton
      icons={{
        success: (
          <CircleCheckIcon className="size-5" />
        ),
        info: (
          <InfoIcon className="size-5" />
        ),
        warning: (
          <TriangleAlertIcon className="size-5" />
        ),
        error: (
          <OctagonXIcon className="size-5" />
        ),
        loading: (
          <Loader2Icon className="size-5 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "color-mix(in oklab, var(--popover) 70%, transparent)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        duration: TOAST_DURATION_MS,
        closeButtonAriaLabel: t("close"),
        classNames: {
          toast: "cn-toast !pr-10 backdrop-blur-md",
          success: "!border-emerald-500/50 !bg-emerald-500/10 [&_[data-icon]]:!text-emerald-500",
          info: "!border-sky-500/50 !bg-sky-500/10 [&_[data-icon]]:!text-sky-500",
          warning: "!border-amber-500/50 !bg-amber-500/10 [&_[data-icon]]:!text-amber-500",
          error: "!border-red-500/50 !bg-red-500/10 [&_[data-icon]]:!text-red-500",
          closeButton:
            "!left-auto !right-2 !top-2 !size-6 !transform-none !rounded-md !border-0 !bg-transparent !text-current opacity-70 transition-colors hover:!bg-foreground/10 hover:opacity-100 active:!scale-90",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

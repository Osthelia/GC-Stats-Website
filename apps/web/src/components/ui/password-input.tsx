"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { Eye, EyeOff } from "lucide-react"

import { cn } from "@/lib/utils"

type PasswordInputProps = Omit<React.ComponentProps<"input">, "type">

function PasswordInput({ className, ...props }: PasswordInputProps) {
  const t = useTranslations("auth")
  const [visible, setVisible] = React.useState(false)
  const Icon = visible ? EyeOff : Eye

  return (
    <div className="relative flex flex-col">
      <input {...props} type={visible ? "text" : "password"} className={cn(className, "w-full pr-10")} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-[9px] text-neutral-400 transition-colors hover:text-[#e4ae22] active:scale-90 active:text-[#c9981d]"
      >
        <Icon className="size-4" aria-hidden />
      </button>
    </div>
  )
}

export { PasswordInput }

/**
 * GC-Stats - org-logo
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Every logo needs a fallback (CLAUDE.md): the org's own initial when a name is known, a generic building icon otherwise (e.g. no organization selected yet in the header switcher). Shared by OrgSwitcher and the /dashboard org picker. */
export function OrgLogoTile({ name, logoUrl, darkLogoUrl, className }: { name: string | null; logoUrl: string | null; darkLogoUrl?: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  const dark = darkLogoUrl ?? logoUrl;

  if (logoUrl && !failed) {
    const imgClass = cn("shrink-0 rounded-lg object-cover", className);
    // Thème sombre du dashboard (classe .dark) : on swap en CSS pour éviter tout flash
    if (dark && dark !== logoUrl) {
      return (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="" className={cn(imgClass, "dark:hidden")} onError={() => setFailed(true)} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dark} alt="" className={cn(imgClass, "hidden dark:block")} onError={() => setFailed(true)} />
        </>
      );
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt="" className={imgClass} onError={() => setFailed(true)} />;
  }

  if (name) {
    return <div className={cn("flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold uppercase text-primary", className)}>{name.charAt(0)}</div>;
  }

  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary", className)}>
      <Building2 className="size-3" />
    </div>
  );
}

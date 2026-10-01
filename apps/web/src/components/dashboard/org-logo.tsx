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
export function OrgLogoTile({ name, logoUrl, className }: { name: string | null; logoUrl: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (logoUrl && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt="" className={cn("shrink-0 rounded-lg object-cover", className)} onError={() => setFailed(true)} />;
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

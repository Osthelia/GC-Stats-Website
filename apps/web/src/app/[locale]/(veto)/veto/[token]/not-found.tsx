/**
 * GC-Stats — not-found
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useTranslations } from "next-intl";

export default function VetoNotFound() {
  const t = useTranslations("veto");
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-xl font-bold">{t("invalidLinkTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("invalidLinkHint")}</p>
    </div>
  );
}

/**
 * GC-Stats - about-sections-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AboutSectionDialog } from "@/components/admin/about-section-dialog";
import { deleteAboutSection } from "@/actions/admin-about";
import type { AboutSectionRow } from "@/lib/admin-about";

export function AboutSectionsPanel({ sections, canManage }: { sections: AboutSectionRow[]; canManage: boolean }) {
  const t = useTranslations("admin.about.sections");
  const router = useRouter();
  const [editing, setEditing] = useState<AboutSectionRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete(section: AboutSectionRow) {
    if (!window.confirm(t("deleteConfirm", { key: section.key }))) return;
    startTransition(async () => {
      const result = await deleteAboutSection(section.id);
      if (!result.ok) {
        toast.error(t(`error.${result.error}`));
        return;
      }
      router.refresh();
      toast.success(t("deleteSuccess"));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("heading")}</h2>
        {canManage && <Button onClick={() => setCreating(true)}>{t("createButton")}</Button>}
      </div>

      {sections.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                {section.title.fr || section.key}
                <Badge variant="outline">{section.key}</Badge>
              </CardTitle>
              {canManage && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(section)}>
                    {t("editButton")}
                  </Button>
                  <Button variant="outline" size="sm" disabled={isPending} onClick={() => handleDelete(section)} className="text-destructive hover:text-destructive">
                    {t("deleteButton")}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <p className="line-clamp-3 text-sm text-muted-foreground">{section.content.fr || t("noContent")}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <AboutSectionDialog section={editing} open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} />
      <AboutSectionDialog section={null} open={creating} onOpenChange={setCreating} />
    </div>
  );
}

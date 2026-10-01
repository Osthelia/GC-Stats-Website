/**
 * GC-Stats - about-team-categories-panel
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
import { AboutTeamCategoryDialog } from "@/components/admin/about-team-category-dialog";
import { deleteAboutTeamCategory } from "@/actions/admin-about-team";
import type { AboutTeamCategoryRow } from "@/lib/admin-about-team";

export function AboutTeamCategoriesPanel({ categories, canManage }: { categories: AboutTeamCategoryRow[]; canManage: boolean }) {
  const t = useTranslations("admin.about.team.categories");
  const router = useRouter();
  const [editing, setEditing] = useState<AboutTeamCategoryRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete(category: AboutTeamCategoryRow) {
    if (!window.confirm(t("deleteConfirm", { key: category.key }))) return;
    startTransition(async () => {
      const result = await deleteAboutTeamCategory(category.id);
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
        <h3 className="text-sm font-semibold text-muted-foreground">{t("heading")}</h3>
        {canManage && (
          <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
            {t("createButton")}
          </Button>
        )}
      </div>

      {categories.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Badge key={category.id} variant="outline" className="flex items-center gap-1 py-1 pr-1 pl-2.5">
              <span>{category.label.fr || category.key}</span>
              {canManage && (
                <span className="flex items-center gap-0.5">
                  <Button variant="ghost" size="xs" onClick={() => setEditing(category)}>
                    {t("editButton")}
                  </Button>
                  <Button variant="ghost" size="xs" disabled={isPending} onClick={() => handleDelete(category)} className="text-destructive hover:text-destructive">
                    {t("deleteButton")}
                  </Button>
                </span>
              )}
            </Badge>
          ))}
        </div>
      )}

      <AboutTeamCategoryDialog category={editing} open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} />
      <AboutTeamCategoryDialog category={null} open={creating} onOpenChange={setCreating} />
    </div>
  );
}

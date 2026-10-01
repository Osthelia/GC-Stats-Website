/**
 * GC-Stats - about-projects-panel
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
import { ActiveStatusBadge } from "@/components/admin/active-status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AboutProjectDialog } from "@/components/admin/about-project-dialog";
import { AboutProjectLogo } from "@/components/admin/about-project-logo";
import { deleteAboutProject } from "@/actions/admin-about";
import type { AboutProjectRow } from "@/lib/admin-about";

export function AboutProjectsPanel({ projects, canManage }: { projects: AboutProjectRow[]; canManage: boolean }) {
  const t = useTranslations("admin.about.projects");
  const router = useRouter();
  const [editing, setEditing] = useState<AboutProjectRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete(project: AboutProjectRow) {
    if (!window.confirm(t("deleteConfirm", { name: project.name }))) return;
    startTransition(async () => {
      const result = await deleteAboutProject(project.id);
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

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columnName")}</TableHead>
              <TableHead>{t("columnType")}</TableHead>
              <TableHead>{t("columnStatus")}</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {projects.map((project) => (
              <TableRow key={project.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <AboutProjectLogo src={project.logoUrl} alt={project.name} />
                    <span className="font-medium">{project.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{project.type}</Badge>
                </TableCell>
                <TableCell>
                  <ActiveStatusBadge active={project.isActive} activeLabel={t("statusActive")} inactiveLabel={t("statusInactive")} />
                </TableCell>
                <TableCell className="text-right">
                  {canManage && (
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditing(project)}>
                        {t("editButton")}
                      </Button>
                      <Button variant="outline" size="sm" disabled={isPending} onClick={() => handleDelete(project)} className="text-destructive hover:text-destructive">
                        {t("deleteButton")}
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AboutProjectDialog project={editing} open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} />
      <AboutProjectDialog project={null} open={creating} onOpenChange={setCreating} />
    </div>
  );
}

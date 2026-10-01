/**
 * GC-Stats - about-team-members-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AboutTeamMemberDialog } from "@/components/admin/about-team-member-dialog";
import type { AboutTeamMemberRow, AboutTeamCategoryRow } from "@/lib/admin-about-team";

export function AboutTeamMembersPanel({
  members,
  categories,
  canManage,
}: {
  members: AboutTeamMemberRow[];
  categories: AboutTeamCategoryRow[];
  canManage: boolean;
}) {
  const t = useTranslations("admin.about.team.members");
  const [editing, setEditing] = useState<AboutTeamMemberRow | null>(null);
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-muted-foreground">{t("heading")}</h3>

      {members.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}

      {members.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colMember")}</TableHead>
              <TableHead>{t("colRoles")}</TableHead>
              <TableHead>{t("colCategory")}</TableHead>
              <TableHead>{t("colVisible")}</TableHead>
              {canManage && <TableHead className="text-right">{t("colActions")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const category = member.categoryId !== null ? categoryById.get(member.categoryId) : undefined;
              const displayName = member.name || member.username;
              return (
                <TableRow key={member.userId}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="size-7">
                        <AvatarImage src={member.image ?? undefined} alt="" />
                        <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{displayName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {member.roleNames.map((name) => (
                        <Badge key={name} variant="outline">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{category ? (category.label.fr || category.key) : <span className="text-muted-foreground">{t("noCategory")}</span>}</TableCell>
                  <TableCell>
                    <Badge variant={member.isVisible ? "outline" : "secondary"}>{member.isVisible ? t("visible") : t("hidden")}</Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setEditing(member)}>
                        {t("editButton")}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <AboutTeamMemberDialog member={editing} categories={categories} open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} />
    </div>
  );
}

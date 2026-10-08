/**
 * GC-Stats - authors-list-table
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OrgLogoTile } from "@/components/dashboard/org-logo";
import type { DashboardAuthorRow } from "@/lib/dashboard-authors-data";

// Accent-insensitive match, the whole list is already loaded client-side.
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function AuthorsListTable({ authors }: { authors: DashboardAuthorRow[] }) {
  const t = useTranslations("dashboard.authors");
  const [search, setSearch] = useState("");

  const needle = normalize(search.trim());
  const filtered = needle ? authors.filter((a) => normalize(`${a.name} ${a.slug} ${a.username ?? ""}`).includes(needle)) : authors;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} className="w-full sm:w-72" />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columnAuthor")}</TableHead>
              <TableHead>{t("columnAccount")}</TableHead>
              <TableHead>{t("columnAccess")}</TableHead>
              <TableHead className="text-right">{t("columnIndividual")}</TableHead>
              <TableHead className="text-right">{t("columnOrganization")}</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {authors.length === 0 ? t("empty") : t("noResults")}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((author) => (
              <TableRow key={author.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <OrgLogoTile name={author.name} logoUrl={author.logoUrl} darkLogoUrl={author.darkLogoUrl} className="size-8" />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{author.name}</div>
                      <div className="truncate font-mono text-xs text-muted-foreground">{author.slug}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{author.username ? `@${author.username}` : "-"}</TableCell>
                <TableCell>
                  <Badge variant={author.isAuthor ? "default" : "outline"}>{author.isAuthor ? t("accessGranted") : t("accessNone")}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{author.individualCount}</TableCell>
                <TableCell className="text-right tabular-nums">{author.organizationCount}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" render={<Link href={`/dashboard/authors/${author.id}`} />}>
                    {t("viewButton")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/**
 * GC-Stats - roster-watch-accounts-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Loader2, Plus, Search } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TeamPicker } from "@/components/admin/team-picker";
import { RosterWatchImportDialog } from "@/components/admin/roster-watch-import-dialog";
import { addMonitoredAccount, setMonitoredAccountEnabled } from "@/actions/admin-roster-watch";
import type { MonitoredAccountRow } from "@/lib/admin-roster-watch";

const ACCOUNTS_PAGE_SIZE = 10;

export function RosterWatchAccountsPanel({ accounts, canManage }: { accounts: MonitoredAccountRow[]; canManage: boolean }) {
  const t = useTranslations("admin.rosterWatch.accounts");
  const format = useFormatter();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [team, setTeam] = useState<{ id: number; name: string } | null>(null);
  const [handle, setHandle] = useState("");
  const [errors, setErrors] = useState<{ team?: string; handle?: string }>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const needle = search.trim().toLowerCase();
  const filtered = needle ? accounts.filter((account) => account.teamName.toLowerCase().includes(needle) || account.xHandle.toLowerCase().includes(needle)) : accounts;
  const totalPages = Math.max(1, Math.ceil(filtered.length / ACCOUNTS_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * ACCOUNTS_PAGE_SIZE, currentPage * ACCOUNTS_PAGE_SIZE);

  function handleAdd() {
    startTransition(async () => {
      const result = await addMonitoredAccount({ teamId: team?.id ?? null, handle });
      if (!result.ok) {
        if (result.field) setErrors({ [result.field]: t(`error.${result.error}`) });
        else toast.error(t(`error.${result.error}`));
        return;
      }
      setErrors({});
      setTeam(null);
      setHandle("");
      toast.success(t("added"));
      router.refresh();
    });
  }

  function handleToggle(account: MonitoredAccountRow, enabled: boolean) {
    startTransition(async () => {
      const result = await setMonitoredAccountEnabled(account.id, enabled);
      if (!result.ok) {
        toast.error(t(`error.${result.error}`));
        return;
      }
      toast.success(t(enabled ? "toastEnabled" : "toastDisabled"));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>
              {t("team")} <span className="text-destructive">*</span>
            </Label>
            <div className="w-56">
              <TeamPicker value={team} onChange={setTeam} placeholder={t("teamPlaceholder")} searchPlaceholder={t("teamSearch")} noResultsLabel={t("teamNoResults")} />
            </div>
            {errors.team && <p className="text-xs text-destructive">{errors.team}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="roster-watch-handle">
              {t("handle")} <span className="text-destructive">*</span>
            </Label>
            <Input id="roster-watch-handle" value={handle} maxLength={80} placeholder="@handle" aria-invalid={!!errors.handle} onChange={(e) => setHandle(e.target.value)} className="w-56" />
            {errors.handle && <p className="text-xs text-destructive">{errors.handle}</p>}
          </div>
          <Button className="mt-[22px]" disabled={isPending} onClick={handleAdd}>
            {isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            {t("add")}
          </Button>
          <div className="mt-[22px] sm:ml-auto">
            <RosterWatchImportDialog />
          </div>
        </div>
      )}

      <div className="relative w-full sm:w-72">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          maxLength={100}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="pl-8"
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("team")}</TableHead>
              <TableHead>{t("handle")}</TableHead>
              <TableHead>{t("lastPolled")}</TableHead>
              <TableHead>{t("lastError")}</TableHead>
              <TableHead className="text-right">{t("enabled")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  {accounts.length === 0 ? t("empty") : t("noResults")}
                </TableCell>
              </TableRow>
            )}
            {visible.map((account) => (
              <TableRow key={account.id}>
                <TableCell className="font-medium">{account.teamName}</TableCell>
                <TableCell>
                  <a href={`https://x.com/${account.xHandle}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    @{account.xHandle}
                  </a>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{account.lastPolledAt ? format.dateTime(new Date(account.lastPolledAt), { dateStyle: "medium", timeStyle: "short" }) : "-"}</TableCell>
                <TableCell className="max-w-72 truncate text-sm text-destructive" title={account.lastError ?? undefined}>
                  {account.lastError ?? "-"}
                </TableCell>
                <TableCell className="text-right">
                  <Switch checked={account.enabled} disabled={!canManage || isPending} aria-label={t("enabled")} onCheckedChange={(checked) => handleToggle(account, checked)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">{t("count", { count: filtered.length })}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" aria-label={t("previous")} disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {currentPage} / {totalPages}
            </span>
            <Button variant="outline" size="sm" aria-label={t("next")} disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

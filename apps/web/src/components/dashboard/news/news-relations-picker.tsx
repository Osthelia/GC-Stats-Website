/**
 * GC-Stats - news-relations-picker
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import { EntityMultiPicker, type EntityOption } from "@/components/dashboard/news/entity-multi-picker";
import { searchDashboardTeams, searchDashboardPeople, searchDashboardTournaments } from "@/actions/dashboard-news";
import { FormField } from "@/components/admin/form-field";

export type NewsRelationsValue = { teams: EntityOption[]; people: EntityOption[]; tournaments: EntityOption[] };

export function NewsRelationsPicker({
  organizationId,
  value,
  onChange,
}: {
  organizationId: number | null;
  value: NewsRelationsValue;
  onChange: (next: NewsRelationsValue) => void;
}) {
  const t = useTranslations("dashboard.news.editor");

  return (
    <div className="flex flex-col gap-4">
      <FormField label={t("relationsTeams")} htmlFor="news-relations-teams">
        <EntityMultiPicker
          value={value.teams}
          onChange={(teams) => onChange({ ...value, teams })}
          search={async (q) => (await searchDashboardTeams(organizationId, q)).map((r) => ({ id: r.id, label: r.name }))}
          placeholder={t("relationsSearchPlaceholder")}
          noResultsLabel={t("relationsNoResults")}
          removeLabel={t("relationsRemove")}
        />
      </FormField>

      <FormField label={t("relationsPeople")} htmlFor="news-relations-people">
        <EntityMultiPicker
          value={value.people}
          onChange={(people) => onChange({ ...value, people })}
          search={async (q) => (await searchDashboardPeople(organizationId, q)).map((r) => ({ id: r.id, label: r.handle }))}
          placeholder={t("relationsSearchPlaceholder")}
          noResultsLabel={t("relationsNoResults")}
          removeLabel={t("relationsRemove")}
        />
      </FormField>

      <FormField label={t("relationsTournaments")} htmlFor="news-relations-tournaments">
        <EntityMultiPicker
          value={value.tournaments}
          onChange={(tournaments) => onChange({ ...value, tournaments })}
          search={async (q) => (await searchDashboardTournaments(organizationId, q)).map((r) => ({ id: r.id, label: r.name }))}
          placeholder={t("relationsSearchPlaceholder")}
          noResultsLabel={t("relationsNoResults")}
          removeLabel={t("relationsRemove")}
        />
      </FormField>
    </div>
  );
}

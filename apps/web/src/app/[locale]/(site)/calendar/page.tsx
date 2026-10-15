import EventCalendar from "@/components/calendar/event-calendar";
import { getCalendarMonth, getCalendarTeam, getCalendarTournamentFacets, isCalendarMonth, offsetCalendarMonth, parseCalendarTeamId, type CalendarFilters } from "@/lib/calendar-data";
import { getTranslations } from "next-intl/server";
import { FilterPill } from "@/components/filters/filter-pill";
import { FilterBar, FilterBarRow } from "@/components/filters/filter-bar";
import { CalendarTeamFilter } from "@/components/calendar/calendar-team-filter";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const t = await getTranslations("tournamentsPage");
  const calendarT = await getTranslations("calendar");
  const raw = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
  const filters: CalendarFilters = {
    region: raw(params.region),
    category: raw(params.category),
    teamId: parseCalendarTeamId(raw(params.team)),
  };
  const requestedMonth = raw(params.month);
  const month = requestedMonth && isCalendarMonth(requestedMonth)
    ? requestedMonth
    : new Date().toISOString().slice(0, 7);
  const previousMonth = offsetCalendarMonth(month, -1);
  const nextMonth = offsetCalendarMonth(month, 1);
  const [monthsEvents, facets, selectedTeam] = await Promise.all([
    Promise.all([previousMonth, month, nextMonth].map((month) => getCalendarMonth(month, filters))),
    getCalendarTournamentFacets(),
    filters.teamId === undefined ? null : getCalendarTeam(filters.teamId),
  ]);
  // Deduplicate events across months.
  const events = [...new Map(monthsEvents.flat().map((event) => [event.id, event])).values()];
  const { region, category } = filters;
  const { regions, categories } = facets;
  const buildHref = (overrides: Partial<Pick<CalendarFilters, "region" | "category">>) => {
    const query = new URLSearchParams({ month });
    if (filters.teamId !== undefined) query.set("team", String(filters.teamId));
    for (const [key, value] of Object.entries({ region, category, ...overrides })) {
      if (value) query.set(key, value);
    }
    return `/calendar?${query}`;
  };

  return (
    <div className="mx-auto max-w-350 space-y-12 px-6 py-9">
      <FilterBar
        mobileToggle={{
          label: t("filtersToggle"),
          activeCount: [region, category, filters.teamId].filter(Boolean).length,
        }}
      >
        <FilterBarRow label={calendarT("filterTeamLabel")}>
          <CalendarTeamFilter selectedTeam={filters.teamId === undefined ? null : (
            selectedTeam ?? { id: filters.teamId, name: calendarT("teamUnavailable") }
          )} />
        </FilterBarRow>
        <FilterBarRow label={t("filterRegionLabel")}>
          <FilterPill
            href={buildHref({ region: "" })}
            active={!region}
            label={t("filterAllRegions")}
          />
          {regions.map((r) => (
            <FilterPill
              key={r}
              href={buildHref({ region: r })}
              active={region === r}
              label={r}
            />
          ))}
        </FilterBarRow>

        <FilterBarRow label={t("filterCategoryLabel")}>
          <FilterPill
            href={buildHref({ category: "" })}
            active={!category}
            label={t("filterAllCategories")}
          />
          {categories.map((c) => (
            <FilterPill
              key={c}
              href={buildHref({ category: c })}
              active={category === c}
              label={c}
            />
          ))}
        </FilterBarRow>
      </FilterBar>
      <EventCalendar month={month} previousMonth={previousMonth} nextMonth={nextMonth} events={events} />
    </div>
  );
}

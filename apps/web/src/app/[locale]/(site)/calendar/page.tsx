import MatchCalendar from "@/components/calendar/match-calendar";
import { getCalendarMonth, getCalendarTournamentFacets, isCalendarMonth, offsetCalendarMonth, type CalendarFilters } from "@/lib/calendar-data";
import { getTranslations } from "next-intl/server";
import { FilterPill } from "@/components/filters/filter-pill";
import { FilterBar, FilterBarRow } from "@/components/filters/filter-bar";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const t = await getTranslations("tournamentsPage");
  const raw = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
  const filters: CalendarFilters = {
    region: raw(params.region),
    category: raw(params.category),
  };
  const requestedMonth = raw(params.month);
  const month = requestedMonth && isCalendarMonth(requestedMonth)
    ? requestedMonth
    : new Date().toISOString().slice(0, 7);
  const previousMonth = offsetCalendarMonth(month, -1);
  const nextMonth = offsetCalendarMonth(month, 1);
  const [monthsEvents, facets] = await Promise.all([
    Promise.all([previousMonth, month, nextMonth].map((month) => getCalendarMonth(month, filters))),
    getCalendarTournamentFacets(),
  ]);
  // Deduplicate events across months.
  const events = [...new Map(monthsEvents.flat().map((event) => [event.id, event])).values()];
  const { region, category } = filters;
  const { regions, categories, years } = facets;
  const buildHref = (overrides: Partial<CalendarFilters>) => {
    const query = new URLSearchParams({ month });
    for (const [key, value] of Object.entries({ ...filters, ...overrides })) {
      if (value) query.set(key, value);
    }
    return `/calendar?${query}`;
  };

  return (
    <div className="mx-auto max-w-350 space-y-12 px-6 py-9">
      <FilterBar
        mobileToggle={{
          label: t("filtersToggle"),
          activeCount: [region, category].filter(Boolean).length,
        }}
      >
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
      <MatchCalendar month={month} previousMonth={previousMonth} nextMonth={nextMonth} events={events} />
    </div>
  );
}

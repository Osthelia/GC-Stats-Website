"use client"; 

import FullCalendar from "@fullcalendar/react";
import themePlugin from "@fullcalendar/react/themes/pulse"; // YOUR THEME
import dayGridPlugin from "@fullcalendar/react/daygrid";
import allLocales from '@fullcalendar/react/locales-all';
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { DatesSetInfo } from "@fullcalendar/react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

// stylesheets
import '@fullcalendar/react/skeleton.css'; // ALWAYS NEED SKELETON
import "@fullcalendar/react/themes/pulse/theme.css";
import './colors.css';

import { useSiteSettings } from "@/lib/site-settings";
import type { CalendarEvent } from "@/lib/calendar-data";
import { useRouter } from "@/i18n/navigation";
import { FilterPill } from "@/components/filters/filter-pill";

function offsetDays(date: string, days: number) {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

type EventCalendarProps = {
  month: string;
  date: string;
  view: "month" | "week";
  previousMonth: string;
  nextMonth: string;
  events: CalendarEvent[];
};

export default function EventCalendar({ month, date, view, previousMonth, nextMonth, events }: EventCalendarProps) {
  const { theme, timezone, clock24 } = useSiteSettings();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("home");
  const calendarT = useTranslations("calendar");
  const [range, setRange] = useState<{ title: string; start: string; end: string } | null>(null);
  const searchParams = useSearchParams();
  const periodHref = useCallback((targetDate: string, targetView = view) => {
    const query = new URLSearchParams(searchParams.toString());
    query.set("month", targetDate.slice(0, 7));
    query.set("date", targetDate);
    if (targetView === "week") query.set("view", "week");
    else query.delete("view");
    return `/calendar?${query}`;
  }, [searchParams, view]);
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const previousDate = view === "week" ? offsetDays(date, -7) : `${previousMonth}-14`;
  const nextDate = view === "week" ? offsetDays(date, 7) : `${nextMonth}-14`;
  const isCurrentPeriod = view === "month" ? month === today.slice(0, 7)
    : !!range && range.start <= today && today < range.end;

  useEffect(() => {
    router.prefetch(periodHref(previousDate));
    router.prefetch(periodHref(nextDate));
  }, [router, previousDate, nextDate, periodHref]);

  const handleDatesSet = useCallback((info: DatesSetInfo) => {
    setRange({ title: info.view.title, start: info.startStr.slice(0, 10), end: info.endStr.slice(0, 10) });
  }, []);
  
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 className="text-xl font-bold">
          {range?.title ?? new Intl.DateTimeFormat(locale, {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(new Date(`${date}T00:00:00Z`))}
        </h2>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <FilterPill href={periodHref(date, "month")} active={view === "month"} label={calendarT("monthView")} />
          <FilterPill href={periodHref(date, "week")} active={view === "week"} label={calendarT("weekView")} />
          <Button
            variant="outline"
            disabled={isCurrentPeriod}
            onClick={() =>
              router.push(periodHref(today), { scroll: false })
            }
          >
            {t("today")}
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={calendarT(view === "week" ? "previousWeek" : "previousMonth")}
            onClick={() =>
              router.push(periodHref(previousDate), { scroll: false })
            }
          >
            <ChevronLeft />
          </Button>

          <Button
            variant="outline"
            size="icon"
            aria-label={calendarT(view === "week" ? "nextWeek" : "nextMonth")}
            onClick={() =>
              router.push(periodHref(nextDate), { scroll: false })
            }
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
      <FullCalendar
        key={`${view}-${date}`}
        initialDate={date}
        datesSet={handleDatesSet}
        headerToolbar={false}
        locales={allLocales}
        locale={locale}
        colorScheme={theme}
        timeZone={timezone}
        plugins={[themePlugin, dayGridPlugin]}
        initialView={view === "week" ? "dayGridWeek" : "dayGridMonth"}
        titleFormat={(info) => {
          const formatter = new Intl.DateTimeFormat(locale, {
            month: view === "week" ? "short" : "long",
            day: view === "week" ? "numeric" : undefined,
            year: "numeric", timeZone: "UTC",
          });
          const start = new Date(Date.UTC(info.start.year, info.start.month, info.start.day));
          const end = info.end && new Date(Date.UTC(info.end.year, info.end.month, info.end.day));
          // Node and browsers can use different whitespace around date-range separators.
          return (view === "week" && end ? formatter.formatRange(start, end) : formatter.format(start)).replace(/\s+/g, " ");
        }}
        contentHeight={view === "week" ? 400 : 1140}
        expandRows={true}
        fixedWeekCount={false}
        dayMaxEvents={true}
        eventTimeFormat={{
          hour: "2-digit",
          minute: "2-digit",
          hour12: !clock24,
        }}
        events={events.map((event) => {
          // skip match events
          if (!event.allDay) return event
          const needLightText = event.extendedProps.region === "INT";
          return {
            ...event,
            // set the same color regardless of the theme since the var changes with dark/light mode
            contrastColor: theme === "dark" ? 
              (needLightText ? "var(--color-neutral-200)" : "var(--color-neutral-900)") 
              : !needLightText ? "var(--color-neutral-200)" : "var(--color-neutral-900)",
          }
        })}
        eventClass="cursor-pointer"
        eventClick={(info) => {
          info.jsEvent.preventDefault();
          router.push(info.event.extendedProps.href);
        }}
      />
    </div>
  );
}

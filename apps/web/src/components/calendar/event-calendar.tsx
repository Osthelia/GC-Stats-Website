"use client"; 

import FullCalendar from "@fullcalendar/react";
import themePlugin from "@fullcalendar/react/themes/pulse"; // YOUR THEME
import dayGridPlugin from "@fullcalendar/react/daygrid";
import allLocales from '@fullcalendar/react/locales-all';
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import type { DatesSetInfo } from "@fullcalendar/react";

// stylesheets
import '@fullcalendar/react/skeleton.css'; // ALWAYS NEED SKELETON
import "@fullcalendar/react/themes/pulse/theme.css";
import './colors.css';

import { useSiteSettings } from "@/lib/site-settings";
import type { CalendarEvent } from "@/lib/calendar-data";
import { useRouter } from "@/i18n/navigation";

type EventCalendarProps = {
  month: string;
  previousMonth: string;
  nextMonth: string;
  events: CalendarEvent[];
};

export default function EventCalendar({ month, previousMonth, nextMonth, events }: EventCalendarProps) {
  const { theme, timezone, clock24 } = useSiteSettings();
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const monthHref = useCallback((targetMonth: string) => {
    const query = new URLSearchParams(searchParams.toString());
    query.set("month", targetMonth);
    return `/calendar?${query}`;
  }, [searchParams]);

  useEffect(() => {
    router.prefetch(monthHref(previousMonth));
    router.prefetch(monthHref(nextMonth));
  }, [router, previousMonth, nextMonth, monthHref]);

  const handleDatesSet = useCallback((info: DatesSetInfo) => {
    // The grid can start in the preceding month. A week inside currentStart
    // identifies the displayed month even across timezone boundary shifts.
    const insideMonth = new Date(info.view.currentStart.getTime() + 7 * 86_400_000);
    const displayedMonth = insideMonth.toISOString().slice(0, 7);
    if (displayedMonth !== month) {
      router.push(monthHref(displayedMonth), { scroll: false });
    }
  }, [month, router, monthHref]);
  
  return (
    <FullCalendar
      key={month}
      initialDate={`${month}-14`}
      datesSet={handleDatesSet}
      headerToolbar={{
        start: 'title',
        end: 'today prev,next',
      }}
      locales={allLocales}
      locale={locale}
      colorScheme={theme}
      timeZone={timezone}
      plugins={[themePlugin, dayGridPlugin]}
      initialView="dayGridMonth"
      eventTimeFormat={{
        hour: "2-digit",
        minute: "2-digit",
        hour12: !clock24,
      }}
      events={events.map((event) => {
        // skip match events
        if (!event.allDay) return event
        const needLightText = event.extendedProps.region === "INT" || event.extendedProps.region === "CN";
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
  );
}

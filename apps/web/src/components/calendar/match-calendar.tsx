"use client"; 

import FullCalendar from "@fullcalendar/react";
import themePlugin from "@fullcalendar/react/themes/pulse"; // YOUR THEME
import dayGridPlugin from "@fullcalendar/react/daygrid";
import allLocales from '@fullcalendar/react/locales-all';
import { useLocale } from "next-intl";
import { useCallback, useEffect } from "react";
import type { DatesSetInfo } from "@fullcalendar/react";

// stylesheets
import '@fullcalendar/react/skeleton.css'; // ALWAYS NEED SKELETON
import "@fullcalendar/react/themes/pulse/theme.css";
import './colors.css';

import { useSiteSettings } from "@/lib/site-settings";
import type { CalendarEvent } from "@/lib/calendar-data";
import { useRouter } from "@/i18n/navigation";

type MatchCalendarProps = {
  month: string;
  previousMonth: string;
  nextMonth: string;
  events: CalendarEvent[];
};

export default function MatchCalendar({ month, previousMonth, nextMonth, events }: MatchCalendarProps) {
  const { theme, timezone, clock24 } = useSiteSettings();
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    router.prefetch(`/calendar?month=${previousMonth}`);
    router.prefetch(`/calendar?month=${nextMonth}`);
  }, [router, previousMonth, nextMonth]);

  const handleDatesSet = useCallback((info: DatesSetInfo) => {
    // The grid can start in the preceding month. A week inside currentStart
    // identifies the displayed month even across timezone boundary shifts.
    const insideMonth = new Date(info.view.currentStart.getTime() + 7 * 86_400_000);
    const displayedMonth = insideMonth.toISOString().slice(0, 7);
    if (displayedMonth !== month) {
      router.push(`/calendar?month=${displayedMonth}`, { scroll: false });
    }
  }, [month, router]);
  
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
      events={events}
      eventClass="cursor-pointer"
      eventClick={(info) => {
        info.jsEvent.preventDefault();
        router.push(info.event.extendedProps.href);
      }}
    />
  );
}

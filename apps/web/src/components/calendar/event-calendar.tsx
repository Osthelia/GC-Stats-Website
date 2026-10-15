"use client"; 

import FullCalendar from "@fullcalendar/react";
import themePlugin from "@fullcalendar/react/themes/pulse"; // YOUR THEME
import dayGridPlugin from "@fullcalendar/react/daygrid";
import allLocales from '@fullcalendar/react/locales-all';
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
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
  const todayMonth = new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
  }).format(new Date());

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
    <div>
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="text-xl font-bold">
          {new Intl.DateTimeFormat(locale, {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(new Date(`${month}-15T00:00:00Z`))}
        </h2>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            disabled={month === todayMonth}
            onClick={() =>
              router.push(monthHref(todayMonth), { scroll: false })
            }
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous month"
            onClick={() =>
              router.push(monthHref(previousMonth), { scroll: false })
            }
          >
            <ChevronLeft />
          </Button>

          <Button
            variant="outline"
            size="icon"
            aria-label="Next month"
            onClick={() =>
              router.push(monthHref(nextMonth), { scroll: false })
            }
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
      <FullCalendar
        key={month}
        initialDate={`${month}-14`}
        datesSet={handleDatesSet}
        headerToolbar={false}
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

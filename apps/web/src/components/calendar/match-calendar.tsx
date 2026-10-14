"use client"; 

import FullCalendar from "@fullcalendar/react";
import themePlugin from "@fullcalendar/react/themes/pulse"; // YOUR THEME
import dayGridPlugin from "@fullcalendar/react/daygrid";
import allLocales from '@fullcalendar/react/locales-all';
import { useLocale } from "next-intl";

// stylesheets
import '@fullcalendar/react/skeleton.css'; // ALWAYS NEED SKELETON
import "@fullcalendar/react/themes/pulse/theme.css";
import './colors.css';

import { useSiteSettings } from "@/lib/site-settings";
import type { ApiMatchListEntry } from "@/lib/api/v2/queries/matches";
import { useRouter } from "@/i18n/navigation";

type MatchCalendarProps = {
  matches: ApiMatchListEntry[];
};

export default function MatchCalendar({matches}: MatchCalendarProps) { 
  const { theme, timezone, clock24 } = useSiteSettings();
  const router = useRouter();
  const loacle = useLocale();
  
  return (
    <FullCalendar
      headerToolbar={{
        start: 'title',
        end: 'today prev,next',
      }}
      locales={allLocales}
      locale={loacle}
      colorScheme={theme}
      timeZone={timezone}
      plugins={[themePlugin, dayGridPlugin]}
      initialView="dayGridMonth"
      eventTimeFormat={{
        hour: "2-digit",
        minute: "2-digit",
        hour12: !clock24,
      }}
      events={matches.filter((match) => match.scheduled_at !== null).map((match) => ({
        id: String(match.id),
        title: `${match.team_a?.team.short_name || 'TBD'} vs ${match.team_b?.team.short_name || 'TBD'}`,
        start: Date.parse(match.scheduled_at || ""),
        allDay: false,
        color: '#d32d50',
        className: 'hover:cursor-pointer',
      }))}
      eventClick={(info) => {
        info.jsEvent.preventDefault();
        router.push(`/match/${info.event.id}`);
      }}
    />
  );
}
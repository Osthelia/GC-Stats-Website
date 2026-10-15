import MatchCalendar from "@/components/calendar/match-calendar";
import { getCalendarMonth, isCalendarMonth, offsetCalendarMonth } from "@/lib/calendar-data";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requestedMonth = Array.isArray(params.month) ? params.month[0] : params.month;
  const month = requestedMonth && isCalendarMonth(requestedMonth)
    ? requestedMonth
    : new Date().toISOString().slice(0, 7);
  const previousMonth = offsetCalendarMonth(month, -1);
  const nextMonth = offsetCalendarMonth(month, 1);
  const monthsEvents = await Promise.all([previousMonth, month, nextMonth].map(getCalendarMonth));
  // Deduplicate events across months.
  const events = [...new Map(monthsEvents.flat().map((event) => [event.id, event])).values()];

  return (
    <div className="mx-auto max-w-350 space-y-12 px-6 py-9">
      <MatchCalendar month={month} previousMonth={previousMonth} nextMonth={nextMonth} events={events} />
    </div>
  );
}

import MatchCalendar from "@/components/calendar/match-calendar";
import { getMatchesV2 } from "@/lib/api/v2/queries/matches";

export default async function CalendarPage() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  const from = new Date(Date.UTC(year, month, 1))
    .toISOString().slice(0, 10);
  const to = new Date(Date.UTC(year, month + 1, 0))
    .toISOString().slice(0, 10);

  const [matches] = await Promise.all([getMatchesV2({
    from,
    to,
    page: 1,
    perPage: 100,
  })])

  return (
    <div className="mx-auto max-w-350 space-y-12 px-6 py-9">
      <MatchCalendar matches={matches.data}/>
    </div>
  );
}

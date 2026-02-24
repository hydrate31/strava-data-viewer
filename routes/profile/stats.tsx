import { FreshContext, Handlers, PageProps } from "$fresh/src/server/types.ts";
import { StravaDataService } from "../../packages/strava.data.service/index.ts";
import { IActivity } from "../../packages/strava.export-data-reader/interface/activity.ts";

interface Props {
  insights: {
    weekly: { label: string; count: number; distanceKm: number }[];
    monthly: { label: string; count: number; distanceKm: number }[];
    prTimeline: {
      date: string;
      sport: string;
      distanceKm: number;
      name: string;
    }[];
    streaks: {
      currentWeekly: number;
      longestWeekly: number;
      currentMonthly: number;
      longestMonthly: number;
    };
    sportDistribution: {
      sport: string;
      count: number;
      distanceKm: number;
      share: number;
    }[];
  };
}

type NormalizedActivity = {
  date: Date;
  dateKey: string;
  activityName: string;
  sport: string;
  distanceKm: number;
};

const asNumber = (value: string | null | undefined) => {
  const n = Number(value ?? "");
  return Number.isFinite(n) ? n : 0;
};

const toDate = (activity: IActivity): Date | null => {
  const raw = activity.activity_date || activity.start_time;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d : null;
};

const normalizeActivities = (activities: IActivity[]): NormalizedActivity[] =>
  activities.map((activity) => {
    const date = toDate(activity);
    if (!date) return null;
    const sport =
      (activity.activity_type || activity.type || "Unknown").trim() ||
      "Unknown";
    const activityName =
      (activity.activity_name || "Untitled Activity").trim() ||
      "Untitled Activity";
    return {
      date,
      dateKey: date.toISOString().slice(0, 10),
      activityName,
      sport,
      distanceKm: Math.max(
        0,
        asNumber(activity.distance || activity.distance2),
      ),
    };
  }).filter((entry): entry is NormalizedActivity => !!entry);

const weekStart = (date: Date) => {
  const copy = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = copy.getUTCDay();
  const diff = (day + 6) % 7;
  copy.setUTCDate(copy.getUTCDate() - diff);
  return copy;
};

const monthStart = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

const formatMonth = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

const formatWeek = (d: Date) => {
  const end = new Date(d);
  end.setUTCDate(d.getUTCDate() + 6);
  return `${d.toISOString().slice(5, 10)} to ${end.toISOString().slice(5, 10)}`;
};

const buildInsights = (activities: IActivity[]) => {
  const normalized = normalizeActivities(activities);
  if (normalized.length === 0) {
    return {
      weekly: [],
      monthly: [],
      prTimeline: [],
      streaks: {
        currentWeekly: 0,
        longestWeekly: 0,
        currentMonthly: 0,
        longestMonthly: 0,
      },
      sportDistribution: [],
    };
  }

  const weeklyMap = new Map<
    string,
    { label: string; count: number; distanceKm: number }
  >();
  const monthlyMap = new Map<
    string,
    { label: string; count: number; distanceKm: number }
  >();
  const sportsMap = new Map<string, { count: number; distanceKm: number }>();

  for (const entry of normalized) {
    const ws = weekStart(entry.date);
    const wk = ws.toISOString().slice(0, 10);
    const month = monthStart(entry.date);
    const mk = formatMonth(month);

    const weekRow = weeklyMap.get(wk) ??
      { label: formatWeek(ws), count: 0, distanceKm: 0 };
    weekRow.count += 1;
    weekRow.distanceKm += entry.distanceKm;
    weeklyMap.set(wk, weekRow);

    const monthRow = monthlyMap.get(mk) ??
      { label: mk, count: 0, distanceKm: 0 };
    monthRow.count += 1;
    monthRow.distanceKm += entry.distanceKm;
    monthlyMap.set(mk, monthRow);

    const sport = sportsMap.get(entry.sport) ?? { count: 0, distanceKm: 0 };
    sport.count += 1;
    sport.distanceKm += entry.distanceKm;
    sportsMap.set(entry.sport, sport);
  }

  const weekly = [...weeklyMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([, value]) => ({
      ...value,
      distanceKm: Number(value.distanceKm.toFixed(1)),
    }));

  const monthly = [...monthlyMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([, value]) => ({
      ...value,
      distanceKm: Number(value.distanceKm.toFixed(1)),
    }));

  const totalActivities = normalized.length;
  const sportDistribution = [...sportsMap.entries()]
    .map(([sport, value]) => ({
      sport,
      count: value.count,
      distanceKm: Number(value.distanceKm.toFixed(1)),
      share: Math.round((value.count / totalActivities) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  const byDate = [...normalized].sort((a, b) =>
    a.date.getTime() - b.date.getTime()
  );
  const bestBySport = new Map<string, number>();
  const prTimeline: {
    date: string;
    sport: string;
    distanceKm: number;
    name: string;
  }[] = [];
  for (const entry of byDate) {
    const prevBest = bestBySport.get(entry.sport) ?? 0;
    if (entry.distanceKm > prevBest) {
      bestBySport.set(entry.sport, entry.distanceKm);
      prTimeline.push({
        date: entry.dateKey,
        sport: entry.sport,
        distanceKm: Number(entry.distanceKm.toFixed(1)),
        name: entry.activityName,
      });
    }
  }

  const weekKeys = new Set([...weeklyMap.keys()]);
  const monthKeys = new Set([...monthlyMap.keys()]);

  const streakLen = (
    start: Date,
    step: "week" | "month",
    keySet: Set<string>,
  ) => {
    let streak = 0;
    const cursor = new Date(start);
    while (true) {
      const key = step === "week"
        ? weekStart(cursor).toISOString().slice(0, 10)
        : formatMonth(monthStart(cursor));
      if (!keySet.has(key)) break;
      streak += 1;
      if (step === "week") cursor.setUTCDate(cursor.getUTCDate() - 7);
      else cursor.setUTCMonth(cursor.getUTCMonth() - 1);
    }
    return streak;
  };

  const currentWeekly = streakLen(new Date(), "week", weekKeys);
  const currentMonthly = streakLen(new Date(), "month", monthKeys);

  let longestWeekly = 0;
  for (const weekKey of weekKeys) {
    longestWeekly = Math.max(
      longestWeekly,
      streakLen(new Date(weekKey), "week", weekKeys),
    );
  }

  let longestMonthly = 0;
  for (const monthKey of monthKeys) {
    const d = new Date(`${monthKey}-01T00:00:00.000Z`);
    longestMonthly = Math.max(longestMonthly, streakLen(d, "month", monthKeys));
  }

  return {
    weekly,
    monthly,
    prTimeline: prTimeline.slice(-20).reverse(),
    streaks: { currentWeekly, longestWeekly, currentMonthly, longestMonthly },
    sportDistribution,
  };
};

export const handler: Handlers<Props> = {
  async GET(_req: Request, ctx: FreshContext) {
    const folder = (ctx.state?.data as any)?.uid ?? "export";
    const strava = new StravaDataService(folder);
    const activities = await strava.activities.list();

    return ctx.render({ insights: buildInsights(activities) });
  },
};

export default function Stats({ data }: PageProps<Props>) {
  return (
    <section>
      <h3>Profile Insights</h3>
      <div class="insight-grid">
        <article>
          <h4>Consistency Streaks</h4>
          <div class="table-scroll">
            <table class="responsive-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Current</th>
                  <th>Longest</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td data-label="Type">Weekly</td>
                  <td data-label="Current">
                    {data.insights.streaks.currentWeekly}
                  </td>
                  <td data-label="Longest">
                    {data.insights.streaks.longestWeekly}
                  </td>
                </tr>
                <tr>
                  <td data-label="Type">Monthly</td>
                  <td data-label="Current">
                    {data.insights.streaks.currentMonthly}
                  </td>
                  <td data-label="Longest">
                    {data.insights.streaks.longestMonthly}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <article>
          <h4>Sport Distribution</h4>
          {data.insights.sportDistribution.length > 0 && (
            <div class="table-scroll">
              <table class="responsive-table">
                <thead>
                  <tr>
                    <th>Sport</th>
                    <th>Activities</th>
                    <th>Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.insights.sportDistribution.map((sport) => (
                    <tr>
                      <td data-label="Sport">{sport.sport}</td>
                      <td data-label="Activities">
                        {sport.count} ({sport.share}%)
                      </td>
                      <td data-label="Distance">{sport.distanceKm} km</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.insights.sportDistribution.length == 0 && <p>None</p>}
        </article>
      </div>

      <div class="insight-grid">
        <article>
          <h4>Weekly Trend (last 12)</h4>
          {data.insights.weekly.length > 0 && (
            <div class="table-scroll">
              <table class="responsive-table">
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Activities</th>
                    <th>Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.insights.weekly.map((week) => (
                    <tr>
                      <td data-label="Week">{week.label}</td>
                      <td data-label="Activities">{week.count}</td>
                      <td data-label="Distance">{week.distanceKm} km</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.insights.weekly.length == 0 && <p>None</p>}
        </article>

        <article>
          <h4>Monthly Trend (last 12)</h4>
          {data.insights.monthly.length > 0 && (
            <div class="table-scroll">
              <table class="responsive-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Activities</th>
                    <th>Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.insights.monthly.map((month) => (
                    <tr>
                      <td data-label="Month">{month.label}</td>
                      <td data-label="Activities">{month.count}</td>
                      <td data-label="Distance">{month.distanceKm} km</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.insights.monthly.length == 0 && <p>None</p>}
        </article>
      </div>

      <article>
        <h4>PR Timeline (distance breakthroughs)</h4>
        {data.insights.prTimeline.length > 0 && (
          <div class="table-scroll">
            <table class="responsive-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Sport</th>
                  <th>Distance PR</th>
                  <th>Activity</th>
                </tr>
              </thead>
              <tbody>
                {data.insights.prTimeline.map((pr) => (
                  <tr>
                    <td data-label="Date">{pr.date}</td>
                    <td data-label="Sport">{pr.sport}</td>
                    <td data-label="Distance PR">{pr.distanceKm} km</td>
                    <td data-label="Activity">{pr.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data.insights.prTimeline.length == 0 && <p>None</p>}
      </article>
    </section>
  );
}

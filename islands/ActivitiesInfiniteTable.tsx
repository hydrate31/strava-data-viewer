import { useEffect, useMemo, useRef, useState } from "preact/hooks";

interface ActivityFilters {
  q: string;
  sport: string;
  date_from: string;
  date_to: string;
  min_distance: string;
  max_distance: string;
}

interface ActivityRow {
  activity_id: string;
  activity_type: string;
  activity_date: string;
  activity_name: string;
  elapsed_time: string;
  distance: string;
  elevation_gain: string;
  hasImage: boolean;
}

interface ActivitiesInfiniteTableProps {
  initialActivities: ActivityRow[];
  activityImageVersion: string;
  filters: ActivityFilters;
  totalActivities: number;
  filteredActivities: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ActivitiesPageResponse {
  activities: ActivityRow[];
  totalActivities: number;
  filteredActivities: number;
  page: number;
  pageSize: number;
  totalPages: number;
  activityImageVersion: string;
}

const queryFromFilters = (
  filters: Record<string, string>,
  page: number,
  pageSize: number,
) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));
  if (pageSize !== 20) params.set("page_size", String(pageSize));
  params.set("format", "json");
  return params.toString();
};

const time = {
  getSeconds: (seconds: number) => seconds % 60,
  getMinutes: (seconds: number) => Math.floor(seconds / 60) % 60,
  getHours: (seconds: number) => Math.floor(Math.floor(seconds / 60) / 60),
};

export default function ActivitiesInfiniteTable(
  props: ActivitiesInfiniteTableProps,
) {
  const [activities, setActivities] = useState<ActivityRow[]>(
    props.initialActivities,
  );
  const [currentPage, setCurrentPage] = useState(props.page);
  const [totalPages, setTotalPages] = useState(props.totalPages);
  const [filteredActivities, setFilteredActivities] = useState(
    props.filteredActivities,
  );
  const [totalActivities, setTotalActivities] = useState(props.totalActivities);
  const [activityImageVersion, setActivityImageVersion] = useState(
    props.activityImageVersion,
  );
  const [loading, setLoading] = useState(false);

  const loadingRef = useRef<HTMLDivElement>(null);

  const hasMore = currentPage < totalPages;

  const filters = useMemo(() => ({
    q: props.filters.q,
    sport: props.filters.sport,
    date_from: props.filters.date_from,
    date_to: props.filters.date_to,
    min_distance: props.filters.min_distance,
    max_distance: props.filters.max_distance,
  }), [props.filters]);

  useEffect(() => {
    if (!loadingRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;
        if (loading || !hasMore) return;

        setLoading(true);
        const nextPage = currentPage + 1;
        const query = queryFromFilters(filters, nextPage, props.pageSize);

        fetch(`/profile/activities?${query}`, {
          cache: "no-store",
        })
          .then((response) => response.ok ? response.json() : null)
          .then((data: ActivitiesPageResponse | null) => {
            if (!data) return;
            setActivities((prev) => {
              const known = new Set(prev.map((row) => row.activity_id));
              const next = data.activities.filter((row) =>
                !known.has(row.activity_id)
              );
              return [...prev, ...next];
            });
            setCurrentPage(data.page);
            setTotalPages(data.totalPages);
            setFilteredActivities(data.filteredActivities);
            setTotalActivities(data.totalActivities);
            setActivityImageVersion(data.activityImageVersion);
          })
          .finally(() => setLoading(false));
      },
      {
        root: null,
        rootMargin: "400px 0px",
      },
    );

    observer.observe(loadingRef.current);
    return () => observer.disconnect();
  }, [loading, hasMore, currentPage, filters, props.pageSize]);

  return (
    <>
      <h3>
        {filteredActivities === 0 && "0 activities found"}
        {filteredActivities > 0 &&
          `Showing 1-${activities.length} of ${filteredActivities} filtered activities (${totalActivities} total)`}
      </h3>
      <table>
        <thead>
          <tr>
            <th>Map</th>
            <th>Sport</th>
            <th>Date</th>
            <th>Title</th>
            <th>Time</th>
            <th>Distance</th>
            <th>Elevation</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((activity) => (
            <tr>
              <td>
                <div class="thumbnail-frame">
                  {activity.hasImage && (
                    <img
                      class="thumbnail-image"
                      src={`/activity-images/${activity.activity_id}.svg?v=${activityImageVersion}`}
                      alt={`Route for ${activity.activity_name}`}
                      loading="lazy"
                    />
                  )}
                  {!activity.hasImage && (
                    <span class="thumbnail-placeholder">No map</span>
                  )}
                </div>
              </td>
              <td>{activity.activity_type}</td>
              <td>{activity.activity_date}</td>
              <td>
                <a href={`/training/activities/${activity.activity_id}`}>
                  {activity.activity_name}
                </a>
              </td>
              <td>
                {time.getHours(parseInt(activity.elapsed_time, 10)) + "h " +
                  time.getMinutes(parseInt(activity.elapsed_time, 10)) + "m " +
                  time.getSeconds(parseInt(activity.elapsed_time, 10)) + "s"}
              </td>
              <td>{activity.distance + " km"}</td>
              <td>{Math.floor(Number(activity.elevation_gain) || 0) + "ft"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div
        ref={loadingRef}
        style="height: 40px; text-align: center; padding: 8px 0;"
      >
        {loading && <span>Loading more...</span>}
        {!loading && !hasMore && filteredActivities > 0 && (
          <span>All activities loaded.</span>
        )}
      </div>
    </>
  );
}

import { FreshContext, Handlers, PageProps } from "$fresh/src/server/types.ts";
import ActivitiesInfiniteTable from "../../islands/ActivitiesInfiniteTable.tsx";
import { TaskType } from "../../packages/sdev.tasks/interfaces/task-type.ts";
import sdevTasks from "../../packages/sdev.tasks/index.ts";
import { StravaDataService } from "../../packages/strava.data.service/index.ts";
import { IActivity } from "../../packages/strava.export-data-reader/interface/activity.ts";
import { IClub } from "../../packages/strava.export-data-reader/interface/club.ts";
import { IFollow } from "../../packages/strava.export-data-reader/interface/follow.ts";
import { IMedia } from "../../packages/strava.export-data-reader/interface/media.ts";
import { IProfile } from "../../packages/strava.export-data-reader/interface/profile.ts";
import {
  deleteView,
  listSavedViews,
  SavedView,
  saveView,
} from "../../helpers/savedViews.ts";

interface ActivityFilters {
  q: string;
  sport: string;
  date_from: string;
  date_to: string;
  min_distance: string;
  max_distance: string;
}

interface Props {
  activities: ActivityRow[];
  totalActivities: number;
  filteredActivities: number;
  page: number;
  pageSize: number;
  totalPages: number;
  profile: IProfile;
  media: IMedia[];
  followers: IFollow[];
  following: IFollow[];
  clubs: IClub[];
  activityImagesStatus: string;
  activityImageVersion: string;
  filters: ActivityFilters;
  sports: string[];
  savedViews: SavedView[];
  message: string | null;
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

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const cleanText = (value: string | null) => (value ?? "").trim();

const cleanDateFilter = (value: string | null) => {
  const raw = cleanText(value);
  if (!raw) return "";
  if (!ISO_DATE_RE.test(raw)) return "";
  const date = new Date(`${raw}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) ? raw : "";
};

const cleanNumberFilter = (value: string | null) => {
  const raw = cleanText(value);
  if (!raw) return "";
  const num = Number(raw);
  return Number.isFinite(num) ? raw : "";
};

const toDate = (activity: IActivity) => {
  const raw = activity.activity_date || activity.start_time;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date : null;
};

const parseNum = (value: string) => {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const toNum = (value: string | null | undefined) => {
  const n = Number(value ?? "");
  return Number.isFinite(n) ? n : 0;
};

const parsePositiveInt = (
  value: string | null,
  fallback: number,
  min: number,
  max: number,
) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
};

const readFilters = (url: URL): ActivityFilters => ({
  q: cleanText(url.searchParams.get("q")),
  sport: cleanText(url.searchParams.get("sport")),
  date_from: cleanDateFilter(url.searchParams.get("date_from")),
  date_to: cleanDateFilter(url.searchParams.get("date_to")),
  min_distance: cleanNumberFilter(url.searchParams.get("min_distance")),
  max_distance: cleanNumberFilter(url.searchParams.get("max_distance")),
});

const applyFilters = (activities: IActivity[], filters: ActivityFilters) => {
  const q = filters.q.trim().toLowerCase();
  const minDistance = parseNum(filters.min_distance);
  const maxDistance = parseNum(filters.max_distance);
  const fromDate = filters.date_from
    ? new Date(`${filters.date_from}T00:00:00.000Z`)
    : null;
  const toDateLimit = filters.date_to
    ? new Date(`${filters.date_to}T23:59:59.999Z`)
    : null;

  return activities.filter((activity) => {
    const sport = (activity.activity_type || "").trim();
    const date = toDate(activity);
    const distance = toNum(activity.distance || activity.distance2);

    if (q) {
      const text = `${activity.activity_name ?? ""} ${
        activity.activity_description ?? ""
      } ${sport}`.toLowerCase();
      if (!text.includes(q)) return false;
    }

    if (filters.sport && sport !== filters.sport) return false;
    if (minDistance != null && distance < minDistance) return false;
    if (maxDistance != null && distance > maxDistance) return false;
    if (fromDate && (!date || date.getTime() < fromDate.getTime())) {
      return false;
    }
    if (toDateLimit && (!date || date.getTime() > toDateLimit.getTime())) {
      return false;
    }

    return true;
  });
};

const queryFromFilters = (
  filters: Record<string, string>,
  page?: number,
  pageSize?: number,
) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  if (page && page > 1) params.set("page", String(page));
  if (pageSize && pageSize !== 20) params.set("page_size", String(pageSize));
  return params.toString();
};

const readActivityImageMeta = async (folder: string) => {
  const ids = new Set<string>();
  let latestTimestamp = 0;

  try {
    for await (
      const entry of Deno.readDir(`./data/${folder}/activity-images`)
    ) {
      if (!entry.isFile || !entry.name.endsWith(".svg")) continue;
      const id = entry.name.replace(".svg", "");
      ids.add(id);

      const stat = await Deno.stat(
        `./data/${folder}/activity-images/${entry.name}`,
      );
      const modified = stat.mtime?.getTime() ?? 0;
      if (modified > latestTimestamp) latestTimestamp = modified;
    }
  } catch {
    // no-op
  }

  return { ids, version: String(latestTimestamp) };
};

const toActivityRow = (
  activity: IActivity,
  hasImage: boolean,
): ActivityRow => ({
  activity_id: activity.activity_id,
  activity_type: activity.activity_type ?? "",
  activity_date: activity.activity_date ?? activity.start_time ?? "",
  activity_name: activity.activity_name ?? "",
  elapsed_time: activity.elapsed_time ?? "0",
  distance: activity.distance ?? activity.distance2 ?? "0",
  elevation_gain: activity.elevation_gain ?? "0",
  hasImage,
});

export const handler: Handlers<Props> = {
  async GET(req: Request, ctx: FreshContext) {
    const folder = (ctx.state?.data as any)?.uid ?? "export";
    const strava = new StravaDataService(folder);
    const url = new URL(req.url);
    const filters = readFilters(url);
    const format = url.searchParams.get("format");
    const requestedPageRaw = parsePositiveInt(
      url.searchParams.get("page"),
      1,
      1,
      100000,
    );
    const requestedPage = format === "json" ? requestedPageRaw : 1;
    const pageSize = parsePositiveInt(
      url.searchParams.get("page_size"),
      20,
      5,
      200,
    );

    const activitiesRaw = await strava.activities.list();
    const activityImageMeta = await readActivityImageMeta(folder);

    const sports = [
      ...new Set(
        activitiesRaw.map((a) => (a.activity_type || "").trim()).filter(
          Boolean,
        ),
      ),
    ].sort();
    if (filters.sport && !sports.includes(filters.sport)) {
      filters.sport = "";
    }
    const filtered = applyFilters(activitiesRaw, filters);
    const totalActivities = activitiesRaw.length;
    const filteredActivities = filtered.length;
    const totalPages = Math.max(1, Math.ceil(filteredActivities / pageSize));
    const page = Math.min(requestedPage, totalPages);
    const pageStart = (page - 1) * pageSize;
    const activities = filtered.slice(pageStart, pageStart + pageSize).map((
      activity,
    ) =>
      toActivityRow(activity, activityImageMeta.ids.has(activity.activity_id))
    );

    if (format === "json") {
      return Response.json({
        activities,
        totalActivities,
        filteredActivities,
        page,
        pageSize,
        totalPages,
        activityImageVersion: activityImageMeta.version,
      });
    }

    const profile = await strava.profile.get();
    const media = await strava.profile.getMedia();
    const followers = await strava.profile.getFollowers();
    const following = await strava.profile.getFollowing();
    const clubs = await strava.profile.getClubs();
    const activityImagesStatus = await sdevTasks.status(
      TaskType.GenerateActivityImages,
      folder,
    );
    const savedViews = await listSavedViews(folder, "activities");

    return ctx.render({
      activities,
      totalActivities,
      filteredActivities,
      page,
      pageSize,
      totalPages,
      profile,
      media,
      followers,
      following,
      clubs,
      activityImagesStatus,
      activityImageVersion: activityImageMeta.version,
      filters,
      sports,
      savedViews,
      message: url.searchParams.get("message"),
    });
  },

  async POST(req: Request, ctx: FreshContext) {
    const folder = (ctx.state?.data as any)?.uid ?? "export";
    const form = await req.formData();
    const action = form.get("action")?.toString() ?? "regenerate_images";

    const filters: Record<string, string> = {
      q: form.get("q")?.toString() ?? "",
      sport: form.get("sport")?.toString() ?? "",
      date_from: form.get("date_from")?.toString() ?? "",
      date_to: form.get("date_to")?.toString() ?? "",
      min_distance: form.get("min_distance")?.toString() ?? "",
      max_distance: form.get("max_distance")?.toString() ?? "",
    };

    if (action === "save_view") {
      const name = form.get("view_name")?.toString() ?? "";
      await saveView(folder, "activities", name, filters);
      const query = queryFromFilters(filters);
      return Response.redirect(
        new URL(
          `/profile/activities?${query}${query ? "&" : ""}message=${
            encodeURIComponent("Saved view.")
          }`,
          req.url,
        ),
        303,
      );
    }

    if (action === "delete_view") {
      const name = form.get("view_name")?.toString() ?? "";
      await deleteView(folder, "activities", name);
      const query = queryFromFilters(filters);
      return Response.redirect(
        new URL(
          `/profile/activities?${query}${query ? "&" : ""}message=${
            encodeURIComponent("Deleted view.")
          }`,
          req.url,
        ),
        303,
      );
    }

    await sdevTasks.forceStop({
      userId: folder,
      type: TaskType.GenerateActivityImages,
      body: "Stopping activity images generation before regeneration.",
    });

    await sdevTasks.enqueue({
      userId: folder,
      type: TaskType.GenerateActivityImages,
      body: "Generating activity route images.",
    });

    return Response.redirect(new URL("/profile/activities", req.url), 303);
  },
};

export const Activities = (props: PageProps<Props>) => (
  <>
    <section>
      <form method="post" encType="multipart/form-data">
        <input type="hidden" name="action" value="regenerate_images" />
        <button
          type="submit"
          disabled={props.data.activityImagesStatus == "running"}
        >
          Regenerate Activity Images{" "}
          {props.data.activityImagesStatus == "running" ? ": Processing" : ""}
        </button>
      </form>
    </section>

    <section>
      <h3>Filters</h3>
      <form method="get">
        <input
          type="text"
          name="q"
          placeholder="Keyword"
          value={props.data.filters.q}
        />
        <select name="sport">
          <option value="">All Sports</option>
          {props.data.sports.map((sport) => (
            <option value={sport} selected={props.data.filters.sport === sport}>
              {sport}
            </option>
          ))}
        </select>
        <input
          type="date"
          name="date_from"
          value={props.data.filters.date_from}
        />
        <input type="date" name="date_to" value={props.data.filters.date_to} />
        <input
          type="number"
          step="0.1"
          name="min_distance"
          placeholder="Min km"
          value={props.data.filters.min_distance}
        />
        <input
          type="number"
          step="0.1"
          name="max_distance"
          placeholder="Max km"
          value={props.data.filters.max_distance}
        />
        <button type="submit">Apply</button>
        <a href="/profile/activities">
          <button type="button">Reset</button>
        </a>
      </form>

      <form method="post">
        <input type="hidden" name="action" value="save_view" />
        <input type="hidden" name="q" value={props.data.filters.q} />
        <input type="hidden" name="sport" value={props.data.filters.sport} />
        <input
          type="hidden"
          name="date_from"
          value={props.data.filters.date_from}
        />
        <input
          type="hidden"
          name="date_to"
          value={props.data.filters.date_to}
        />
        <input
          type="hidden"
          name="min_distance"
          value={props.data.filters.min_distance}
        />
        <input
          type="hidden"
          name="max_distance"
          value={props.data.filters.max_distance}
        />
        <input
          type="text"
          name="view_name"
          placeholder="Save current view as..."
        />
        <button type="submit">Save View</button>
      </form>

      {props.data.savedViews.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Saved Views</th>
              <th>Apply</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
            {props.data.savedViews.map((view) => (
              <tr>
                <td>{view.name}</td>
                <td>
                  <a
                    href={`/profile/activities?${
                      queryFromFilters(view.filters, 1, props.data.pageSize)
                    }`}
                  >
                    Open
                  </a>
                </td>
                <td>
                  <form method="post">
                    <input type="hidden" name="action" value="delete_view" />
                    <input type="hidden" name="view_name" value={view.name} />
                    <input
                      type="hidden"
                      name="q"
                      value={props.data.filters.q}
                    />
                    <input
                      type="hidden"
                      name="sport"
                      value={props.data.filters.sport}
                    />
                    <input
                      type="hidden"
                      name="date_from"
                      value={props.data.filters.date_from}
                    />
                    <input
                      type="hidden"
                      name="date_to"
                      value={props.data.filters.date_to}
                    />
                    <input
                      type="hidden"
                      name="min_distance"
                      value={props.data.filters.min_distance}
                    />
                    <input
                      type="hidden"
                      name="max_distance"
                      value={props.data.filters.max_distance}
                    />
                    <button type="submit" class="danger">Delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {props.data.message && (
        <p>
          <strong>{props.data.message}</strong>
        </p>
      )}
    </section>

    <ActivitiesInfiniteTable
      initialActivities={props.data.activities}
      activityImageVersion={props.data.activityImageVersion}
      filters={props.data.filters}
      totalActivities={props.data.totalActivities}
      filteredActivities={props.data.filteredActivities}
      page={props.data.page}
      pageSize={props.data.pageSize}
      totalPages={props.data.totalPages}
    />
  </>
);

export default Activities;

import { FreshContext, Handlers, PageProps } from "$fresh/src/server/types.ts";
import sdevTasks from "../../packages/sdev.tasks/index.ts";
import { QueueEntry } from "../../packages/sdev.tasks/interfaces/queue-entry.ts";
import { TaskType } from "../../packages/sdev.tasks/interfaces/task-type.ts";
import { StravaDataService } from "../../packages/strava.data.service/index.ts";
import { IContact } from "../../packages/strava.export-data-reader/interface/contact.ts";
import { IFollow } from "../../packages/strava.export-data-reader/interface/follow.ts";
import { IMedia } from "../../packages/strava.export-data-reader/interface/media.ts";
import { IProfile } from "../../packages/strava.export-data-reader/interface/profile.ts";
import { IAthlete } from "../../packages/strava.wget.service/athletes.ts";
import {
  deleteView,
  listSavedViews,
  SavedView,
  saveView,
} from "../../helpers/savedViews.ts";

interface FollowFilters {
  q: string;
  date_from: string;
  date_to: string;
  sport: string;
  min_distance: string;
  max_distance: string;
}

interface Props {
  athletes: IAthlete[];
  profile: IProfile;
  media: IMedia[];
  followers: IFollow[];
  following: IFollow[];
  contacts: IContact[];
  savedViews: SavedView[];
  filters: FollowFilters;
  message: string | null;
}

const readFilters = (url: URL): FollowFilters => ({
  q: url.searchParams.get("q") ?? "",
  date_from: url.searchParams.get("date_from") ?? "",
  date_to: url.searchParams.get("date_to") ?? "",
  sport: url.searchParams.get("sport") ?? "",
  min_distance: url.searchParams.get("min_distance") ?? "",
  max_distance: url.searchParams.get("max_distance") ?? "",
});

const queryFromFilters = (filters: Record<string, string>) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  return params.toString();
};

const filterFollows = (
  follows: IFollow[],
  filters: FollowFilters,
  athletes: IAthlete[],
  contacts: IContact[],
) => {
  const q = filters.q.trim().toLowerCase();
  const fromDate = filters.date_from
    ? new Date(`${filters.date_from}T00:00:00.000Z`)
    : null;
  const toDate = filters.date_to
    ? new Date(`${filters.date_to}T23:59:59.999Z`)
    : null;

  return follows.filter((follow) => {
    if (q) {
      const athlete = athletes.find((entry) => entry.id == follow.athelete_id);
      const contact = contacts.find((entry) =>
        entry.athlete_id == follow.athelete_id
      );
      const text = `${follow.athelete_id} ${athlete?.name ?? ""} ${
        contact?.contact ?? ""
      } ${follow.status ?? ""}`.toLowerCase();
      if (!text.includes(q)) return false;
    }

    if (fromDate || toDate) {
      const raw = follow.created_at;
      const date = raw ? new Date(raw) : null;
      const valid = date && Number.isFinite(date.getTime());
      if (fromDate && (!valid || date.getTime() < fromDate.getTime())) {
        return false;
      }
      if (toDate && (!valid || date.getTime() > toDate.getTime())) return false;
    }

    return true;
  });
};

export const handler: Handlers<Props> = {
  async GET(req: Request, ctx: FreshContext) {
    const folder = (ctx.state?.data as any)?.uid ?? "export";
    const strava = new StravaDataService(folder);
    const url = new URL(req.url);
    const filters = readFilters(url);

    const athletes = await strava.athletes.list();
    const profile = await strava.profile.get();
    const media = await strava.profile.getMedia();
    const followersRaw = await strava.profile.getFollowers();
    const followingRaw = await strava.profile.getFollowing();
    const contacts = await strava.profile.getContacts();

    return ctx.render({
      athletes,
      profile,
      media,
      followers: filterFollows(followersRaw, filters, athletes, contacts),
      following: filterFollows(followingRaw, filters, athletes, contacts),
      contacts,
      savedViews: await listSavedViews(folder, "followers"),
      filters,
      message: url.searchParams.get("message"),
    });
  },

  async POST(req: Request, ctx: FreshContext) {
    const folder = (ctx.state?.data as any)?.uid ?? "export";
    const form = await req.formData();
    const action = form.get("action")?.toString() ?? "reprocess_athletes";

    const filters: Record<string, string> = {
      q: form.get("q")?.toString() ?? "",
      date_from: form.get("date_from")?.toString() ?? "",
      date_to: form.get("date_to")?.toString() ?? "",
      sport: form.get("sport")?.toString() ?? "",
      min_distance: form.get("min_distance")?.toString() ?? "",
      max_distance: form.get("max_distance")?.toString() ?? "",
    };

    if (action === "save_view") {
      const name = form.get("view_name")?.toString() ?? "";
      await saveView(folder, "followers", name, filters);
      const query = queryFromFilters(filters);
      return Response.redirect(
        new URL(
          `/profile/followers?${query}${query ? "&" : ""}message=${
            encodeURIComponent("Saved view.")
          }`,
          req.url,
        ),
        303,
      );
    }

    if (action === "delete_view") {
      const name = form.get("view_name")?.toString() ?? "";
      await deleteView(folder, "followers", name);
      const query = queryFromFilters(filters);
      return Response.redirect(
        new URL(
          `/profile/followers?${query}${query ? "&" : ""}message=${
            encodeURIComponent("Deleted view.")
          }`,
          req.url,
        ),
        303,
      );
    }

    if (
      await sdevTasks.status(TaskType.ProcessAthletes, folder) !== "running"
    ) {
      sdevTasks.enqueue({
        userId: folder,
        type: TaskType.ProcessAthletes,
        body: "Fetching athelete information...",
      } as QueueEntry);
    }

    return Response.redirect(new URL("/profile/followers", req.url), 303);
  },
};

export const Followers = (props: PageProps<Props>) => (
  <>
    <section class="page-toolbar">
      <form method="POST" class="inline-form">
        <input type="hidden" name="action" value="reprocess_athletes" />
        <button class="primary">Re-process Athletes</button>
      </form>
    </section>

    <section>
      <h3>Filters</h3>
      <form method="get" class="filter-form">
        <input
          type="text"
          name="q"
          placeholder="Keyword"
          value={props.data.filters.q}
        />
        <input
          type="date"
          name="date_from"
          value={props.data.filters.date_from}
        />
        <input type="date" name="date_to" value={props.data.filters.date_to} />
        <input
          type="text"
          name="sport"
          placeholder="Sport"
          value={props.data.filters.sport}
        />
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
        <button type="submit" class="primary">Apply</button>
        <a href="/profile/followers" class="button-link secondary">Reset</a>
      </form>

      <form method="post" class="saved-view-form">
        <input type="hidden" name="action" value="save_view" />
        <input type="hidden" name="q" value={props.data.filters.q} />
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
        <input type="hidden" name="sport" value={props.data.filters.sport} />
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
        <button type="submit" class="primary">Save View</button>
      </form>

      {props.data.savedViews.length > 0 && (
        <div class="table-scroll">
          <table class="compact-table responsive-table">
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
                  <td data-label="Saved Views">{view.name}</td>
                  <td data-label="Apply">
                    <a
                      class="button-link"
                      href={`/profile/followers?${
                        queryFromFilters(view.filters)
                      }`}
                    >
                      Open
                    </a>
                  </td>
                  <td data-label="Delete">
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
                        name="sport"
                        value={props.data.filters.sport}
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
        </div>
      )}

      {props.data.message && (
        <p>
          <strong>{props.data.message}</strong>
        </p>
      )}
    </section>

    <section>
      <h3>Following</h3>
      {props.data.following.length > 0 && (
        <div class="table-scroll">
          <table class="responsive-table">
            <thead>
              <tr>
                <th>Athelete</th>
                <th>Contact</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {props.data.following.map((follow: any) => (
                <tr>
                  <td data-label="Athelete">
                    <img
                      src={props.data.athletes?.find((entry) =>
                        entry.id == follow.athelete_id
                      )?.avatarUrl}
                      class="avatar-inline"
                    />
                    <a
                      href={`https://www.strava.com/athletes/${follow.athelete_id}`}
                    >
                      {props.data.athletes?.find((entry) =>
                        entry.id == follow.athelete_id
                      )?.name ?? follow.athelete_id}
                    </a>
                  </td>
                  <td data-label="Contact">
                    {props.data.contacts.find((contact) =>
                      contact.athlete_id == follow.athelete_id
                    )?.contact ?? "-"}
                  </td>
                  <td data-label="Status" title={follow.created_at}>
                    <button disabled>
                      {follow.status == "Accepted"
                        ? "Follow Requested"
                        : "Following"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {props.data.following.length == 0 && <p>None</p>}
      <br />

      <h3>Followers</h3>

      {props.data.followers.length > 0 && (
        <div class="table-scroll">
          <table class="responsive-table">
            <thead>
              <tr>
                <th>Athelete</th>
                <th>Contact</th>
              </tr>
            </thead>
            <tbody>
              {props.data.followers.map((follow: any) => (
                <tr>
                  <td data-label="Athelete">
                    <img
                      src={props.data.athletes?.find((entry) =>
                        entry.id == follow.athelete_id
                      )?.avatarUrl}
                      class="avatar-inline"
                    />
                    <a
                      href={`https://www.strava.com/athletes/${follow.athelete_id}`}
                    >
                      {props.data.athletes?.find((entry) =>
                        entry.id == follow.athelete_id
                      )?.name ?? follow.athelete_id}
                    </a>
                  </td>
                  <td data-label="Contact">
                    {props.data.contacts.find((contact) =>
                      contact.athlete_id == follow.athelete_id
                    )?.contact ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {props.data.followers.length == 0 && <p>None</p>}
    </section>
  </>
);

export default Followers;

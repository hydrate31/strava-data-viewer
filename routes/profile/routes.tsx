import { Head } from "$fresh/runtime.ts";
import { FreshContext, Handlers, PageProps } from "$fresh/src/server/types.ts";
import { TaskType } from "../../packages/sdev.tasks/interfaces/task-type.ts";
import sdevTasks from "../../packages/sdev.tasks/index.ts";
import { StravaDataService } from "../../packages/strava.data.service/index.ts";
import { IMedia } from "../../packages/strava.export-data-reader/interface/media.ts";
import { IProfile } from "../../packages/strava.export-data-reader/interface/profile.ts";
import { IRoute } from "../../packages/strava.export-data-reader/interface/route.ts";
import StatePanel from "../../components/StatePanel.tsx";
import {
  deleteView,
  listSavedViews,
  SavedView,
  saveView,
} from "../../helpers/savedViews.ts";

interface RouteFilters {
  q: string;
  date_from: string;
  date_to: string;
  min_distance: string;
  max_distance: string;
  sport: string;
}

interface Props {
  profile: IProfile;
  media: IMedia[];
  routes: IRoute[];
  routeImagesStatus: string;
  routeImageVersion: string;
  routeImageIds: string[];
  filters: RouteFilters;
  savedViews: SavedView[];
  message: string | null;
}

const routeImageId = (filename: string) => {
  return filename
    .replace("routes/", "")
    .replace(".gpx", "")
    .replaceAll("/", "_")
    .replaceAll("\\", "_")
    .replaceAll("..", "_");
};

const queryFromFilters = (filters: Record<string, string>) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  return params.toString();
};

const readFilters = (url: URL): RouteFilters => ({
  q: url.searchParams.get("q") ?? "",
  date_from: url.searchParams.get("date_from") ?? "",
  date_to: url.searchParams.get("date_to") ?? "",
  min_distance: url.searchParams.get("min_distance") ?? "",
  max_distance: url.searchParams.get("max_distance") ?? "",
  sport: url.searchParams.get("sport") ?? "",
});

const applyFilters = (routes: IRoute[], filters: RouteFilters) => {
  const q = filters.q.trim().toLowerCase();
  return routes.filter((route) => {
    if (!q) return true;
    return `${route.name} ${route.filename}`.toLowerCase().includes(q);
  });
};

export const handler: Handlers<Props> = {
  async GET(req: Request, ctx: FreshContext) {
    const folder = (ctx.state?.data as any)?.uid ?? "export";
    const strava = new StravaDataService(folder);
    const url = new URL(req.url);
    const filters = readFilters(url);

    const profile = await strava.profile.get();
    const media = await strava.profile.getMedia();
    const routesRaw = await strava.routes.list();
    const routeImagesStatus = await sdevTasks.status(
      TaskType.GenerateRouteImages,
      folder,
    );
    const routeImageIds: string[] = [];
    let latestImageTimestamp = 0;

    try {
      for await (const entry of Deno.readDir(`./data/${folder}/route-images`)) {
        if (!entry.isFile || !entry.name.endsWith(".svg")) continue;
        const id = entry.name.replace(".svg", "");
        routeImageIds.push(id);

        const stat = await Deno.stat(
          `./data/${folder}/route-images/${entry.name}`,
        );
        const modified = stat.mtime?.getTime() ?? 0;
        if (modified > latestImageTimestamp) latestImageTimestamp = modified;
      }
    } catch {
      // no-op
    }

    return ctx.render({
      profile,
      media,
      routes: applyFilters(routesRaw, filters),
      routeImagesStatus,
      routeImageVersion: String(latestImageTimestamp),
      routeImageIds,
      filters,
      savedViews: await listSavedViews(folder, "routes"),
      message: url.searchParams.get("message"),
    });
  },

  async POST(req: Request, ctx: FreshContext) {
    const folder = (ctx.state?.data as any)?.uid ?? "export";
    const form = await req.formData();
    const action = form.get("action")?.toString() ?? "regenerate_images";

    const filters: Record<string, string> = {
      q: form.get("q")?.toString() ?? "",
      date_from: form.get("date_from")?.toString() ?? "",
      date_to: form.get("date_to")?.toString() ?? "",
      min_distance: form.get("min_distance")?.toString() ?? "",
      max_distance: form.get("max_distance")?.toString() ?? "",
      sport: form.get("sport")?.toString() ?? "",
    };

    if (action === "save_view") {
      const name = form.get("view_name")?.toString() ?? "";
      await saveView(folder, "routes", name, filters);
      const query = queryFromFilters(filters);
      return Response.redirect(
        new URL(
          `/profile/routes?${query}${query ? "&" : ""}message=${
            encodeURIComponent("Saved view.")
          }`,
          req.url,
        ),
        303,
      );
    }

    if (action === "delete_view") {
      const name = form.get("view_name")?.toString() ?? "";
      await deleteView(folder, "routes", name);
      const query = queryFromFilters(filters);
      return Response.redirect(
        new URL(
          `/profile/routes?${query}${query ? "&" : ""}message=${
            encodeURIComponent("Deleted view.")
          }`,
          req.url,
        ),
        303,
      );
    }

    await sdevTasks.forceStop({
      userId: folder,
      type: TaskType.GenerateRouteImages,
      body: "Stopping route images generation before regeneration.",
    });

    await sdevTasks.enqueue({
      userId: folder,
      type: TaskType.GenerateRouteImages,
      body: "Generating route images.",
    });

    return Response.redirect(new URL("/profile/routes", req.url), 303);
  },
};

export const Routes = ({ data }: PageProps<Props>) => (
  <>
    <Head>
      <title>Routes</title>
    </Head>
    <section class="page-toolbar">
      <form method="post" encType="multipart/form-data" class="inline-form">
        <input type="hidden" name="action" value="regenerate_images" />
        <button
          class="primary"
          type="submit"
          disabled={data.routeImagesStatus == "running"}
        >
          Regenerate Route Images{" "}
          {data.routeImagesStatus == "running" ? ": Processing" : ""}
        </button>
      </form>
    </section>

    <section>
      <h3>Filters</h3>
      <form method="get" class="filter-form">
        <input
          type="text"
          name="q"
          placeholder="Keyword"
          value={data.filters.q}
        />
        <input type="date" name="date_from" value={data.filters.date_from} />
        <input type="date" name="date_to" value={data.filters.date_to} />
        <input
          type="number"
          step="0.1"
          name="min_distance"
          placeholder="Min km"
          value={data.filters.min_distance}
        />
        <input
          type="number"
          step="0.1"
          name="max_distance"
          placeholder="Max km"
          value={data.filters.max_distance}
        />
        <input
          type="text"
          name="sport"
          placeholder="Sport"
          value={data.filters.sport}
        />
        <button type="submit" class="primary">Apply</button>
        <a href="/profile/routes" class="button-link secondary">Reset</a>
      </form>

      <form method="post" class="saved-view-form">
        <input type="hidden" name="action" value="save_view" />
        <input type="hidden" name="q" value={data.filters.q} />
        <input type="hidden" name="date_from" value={data.filters.date_from} />
        <input type="hidden" name="date_to" value={data.filters.date_to} />
        <input
          type="hidden"
          name="min_distance"
          value={data.filters.min_distance}
        />
        <input
          type="hidden"
          name="max_distance"
          value={data.filters.max_distance}
        />
        <input type="hidden" name="sport" value={data.filters.sport} />
        <input
          type="text"
          name="view_name"
          placeholder="Save current view as..."
        />
        <button type="submit" class="primary">Save View</button>
      </form>

      {data.savedViews.length > 0 && (
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
              {data.savedViews.map((view) => (
                <tr>
                  <td data-label="Saved Views">{view.name}</td>
                  <td data-label="Apply">
                    <a
                      class="button-link"
                      href={`/profile/routes?${queryFromFilters(view.filters)}`}
                    >
                      Open
                    </a>
                  </td>
                  <td data-label="Delete">
                    <form method="post">
                      <input type="hidden" name="action" value="delete_view" />
                      <input type="hidden" name="view_name" value={view.name} />
                      <input type="hidden" name="q" value={data.filters.q} />
                      <input
                        type="hidden"
                        name="date_from"
                        value={data.filters.date_from}
                      />
                      <input
                        type="hidden"
                        name="date_to"
                        value={data.filters.date_to}
                      />
                      <input
                        type="hidden"
                        name="min_distance"
                        value={data.filters.min_distance}
                      />
                      <input
                        type="hidden"
                        name="max_distance"
                        value={data.filters.max_distance}
                      />
                      <input
                        type="hidden"
                        name="sport"
                        value={data.filters.sport}
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

      {data.message && (
        <StatePanel
          kind="info"
          title={data.message}
          actions={[
            { href: "/profile/routes", label: "Refresh", primary: true },
            { href: "/tasks", label: "Open Tasks" },
          ]}
        />
      )}
    </section>

    {data.routes.length > 0 && (
      <div class="table-scroll">
        <table class="responsive-table">
          <thead>
            <tr>
              <th>Map</th>
              <th>Name</th>
              <th>File</th>
            </tr>
          </thead>
          <tbody>
            {data.routes.map((route) => (
              <tr>
                <td data-label="Map">
                  <div class="thumbnail-frame">
                    {data.routeImageIds.includes(
                      routeImageId(route.filename),
                    ) &&
                      (
                        <img
                          class="thumbnail-image"
                          src={`/route-images/${
                            routeImageId(route.filename)
                          }.svg?v=${data.routeImageVersion}`}
                          alt={`Route image for ${route.name}`}
                          loading="lazy"
                        />
                      )}
                    {!data.routeImageIds.includes(
                      routeImageId(route.filename),
                    ) &&
                      <span class="thumbnail-placeholder">No map</span>}
                  </div>
                </td>
                <td data-label="Name">
                  <a
                    href={`/routes/${
                      route.filename.replace("routes/", "").replace(".gpx", "")
                    }`}
                  >
                    {route.name}
                  </a>
                </td>
                <td data-label="File">{route.filename}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
    {data.routes.length == 0 && (
      <StatePanel
        title="No routes found"
        description="No route records are available for this export."
        actions={[
          { href: "/upload", label: "Re-import data", primary: true },
          { href: "/profile/routes", label: "Reset filters" },
        ]}
      />
    )}
  </>
);

export default Routes;

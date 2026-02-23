import { Head } from "$fresh/runtime.ts";
import { FreshContext, PageProps, Handlers } from "$fresh/src/server/types.ts";
import { QueueEntry } from "../../packages/sdev.tasks/interfaces/queue-entry.ts";
import { TaskType } from "../../packages/sdev.tasks/interfaces/task-type.ts";
import sdevTasks from "../../packages/sdev.tasks/index.ts";
import { StravaDataService } from "../../packages/strava.data.service/index.ts";
import { IMedia } from "../../packages/strava.export-data-reader/interface/media.ts";
import { IProfile } from "../../packages/strava.export-data-reader/interface/profile.ts";
import { IRoute } from "../../packages/strava.export-data-reader/interface/route.ts";

interface Props {
    profile: IProfile
    media: IMedia[]
    routes: IRoute[]
    routeImagesStatus: string
    routeImageVersion: string
    routeImageIds: string[]
}

const routeImageId = (filename: string) => {
    return filename
        .replace("routes/", "")
        .replace(".gpx", "")
        .replaceAll("/", "_")
        .replaceAll("\\", "_")
        .replaceAll("..", "_");
};
  
export const handler: Handlers<Props> = {
    async GET(_req: Request, ctx: FreshContext) {
        const folder = (ctx.state?.data as any)?.uid ?? 'export';
        const strava = new StravaDataService(folder)
    
        const profile = await strava.profile.get();
        const media = await strava.profile.getMedia();
        const routes = await strava.routes.list();
        const routeImagesStatus = await sdevTasks.status(TaskType.GenerateRouteImages, folder);
        const routeImageIds: string[] = [];
        let latestImageTimestamp = 0;

        try {
            for await (const entry of Deno.readDir(`./data/${folder}/route-images`)) {
                if (!entry.isFile || !entry.name.endsWith(".svg")) continue;
                const id = entry.name.replace(".svg", "");
                routeImageIds.push(id);

                const stat = await Deno.stat(`./data/${folder}/route-images/${entry.name}`);
                const modified = stat.mtime?.getTime() ?? 0;
                if (modified > latestImageTimestamp) latestImageTimestamp = modified;
            }
        } catch {}

        return ctx.render({
            profile,
            media,
            routes,
            routeImagesStatus,
            routeImageVersion: String(latestImageTimestamp),
            routeImageIds,
        });
    },

    async POST(_req: Request, ctx: FreshContext) {
        const exportFilename = (ctx.state?.data as any)?.uid ?? 'export';

        await sdevTasks.nullify({
            userId: exportFilename,
            type: TaskType.GenerateRouteImages,
            body: "Nullifying route images generation."
        } as QueueEntry);

        sdevTasks.enqueue({
            userId: exportFilename,
            type: TaskType.GenerateRouteImages,
            body: "Generating route images."
        } as QueueEntry);

        const { pathname } = new URL(_req.url);
        const fullUrl = _req.url.replace(pathname, "");
        return Response.redirect(fullUrl + "/profile/routes");
    },
};

export const Routes = ({ data }: PageProps<Props>) => <>
    <Head>
        <title>Routes</title>
    </Head>
    <section>
        <form method="post" encType="multipart/form-data">
            <button type="submit" disabled={data.routeImagesStatus == "running"}>
                Regenerate Route Images {data.routeImagesStatus == "running" ? ": Processing" : ""}
            </button>
        </form>
    </section>

    <table>
        <thead>
            <tr>
                <th>Map</th>
                <th>Name</th>
                <th>File</th>
            </tr>
        </thead>
        <tbody>
            {data.routes.map(route => <tr>
                <td>
                    <div class="thumbnail-frame">
                        {data.routeImageIds.includes(routeImageId(route.filename)) && <img
                            class="thumbnail-image"
                            src={`/route-images/${routeImageId(route.filename)}.svg?v=${data.routeImageVersion}`}
                            alt={`Route image for ${route.name}`}
                            loading="lazy"
                        />}
                        {!data.routeImageIds.includes(routeImageId(route.filename)) && <span class="thumbnail-placeholder">No map</span>}
                    </div>
                </td>
                <td><a href={`/routes/${route.filename.replace("routes/", "").replace(".gpx", "")}`}>{route.name}</a></td>
                <td>{route.filename}</td>
            </tr>)}
        </tbody>
    </table>
</>

export default Routes

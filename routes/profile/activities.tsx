import { Head } from "$fresh/runtime.ts";
import { FreshContext, PageProps, Handlers } from "$fresh/src/server/types.ts";
import { TaskType } from "../../packages/sdev.tasks/interfaces/task-type.ts";
import sdevTasks from "../../packages/sdev.tasks/index.ts";
import { StravaDataService } from "../../packages/strava.data.service/index.ts";
import { IActivity } from "../../packages/strava.export-data-reader/interface/activity.ts";
import { IClub } from "../../packages/strava.export-data-reader/interface/club.ts";
import { IFollow } from "../../packages/strava.export-data-reader/interface/follow.ts";
import { IMedia } from "../../packages/strava.export-data-reader/interface/media.ts";
import { IProfile } from "../../packages/strava.export-data-reader/interface/profile.ts";

interface Props {
    activities: IActivity[]
    profile: IProfile
    media: IMedia[]
    followers: IFollow[]
    following: IFollow[]
    clubs: IClub[]
    activityImagesStatus: string
    activityImageVersion: string
    activityImageIds: string[]
}

const time = {
    getSeconds: (seconds: number) => seconds % 60,
    getMinutes: (seconds: number) => Math.floor(seconds / 60) % 60,
    getHours: (seconds: number) => Math.floor(Math.floor(seconds / 60) / 60),
}
  
export const handler: Handlers<Props> = {
    async GET(_req: Request, ctx: FreshContext) {
        const folder = (ctx.state?.data as any)?.uid ?? 'export';
        const strava = new StravaDataService(folder)

        const activities = await strava.activities.list();
        const profile = await strava.profile.get();
        const media = await strava.profile.getMedia();
        const followers = await strava.profile.getFollowers();
        const following = await strava.profile.getFollowing();
        const clubs = await strava.profile.getClubs();
        const activityImagesStatus = await sdevTasks.status(TaskType.GenerateActivityImages, folder);
        const activityImageIds: string[] = [];
        let latestImageTimestamp = 0;

        try {
            for await (const entry of Deno.readDir(`./data/${folder}/activity-images`)) {
                if (!entry.isFile || !entry.name.endsWith(".svg")) continue;
                const id = entry.name.replace(".svg", "");
                activityImageIds.push(id);

                const stat = await Deno.stat(`./data/${folder}/activity-images/${entry.name}`);
                const modified = stat.mtime?.getTime() ?? 0;
                if (modified > latestImageTimestamp) latestImageTimestamp = modified;
            }
        } catch {}

        return ctx.render({
            activities,
            profile,
            media,
            followers,
            following,
            clubs,
            activityImagesStatus,
            activityImageVersion: String(latestImageTimestamp),
            activityImageIds
        });
    },

    async POST(_req: Request, ctx: FreshContext) {
        const exportFilename = (ctx.state?.data as any)?.uid ?? 'export';

        await sdevTasks.forceStop({
            userId: exportFilename,
            type: TaskType.GenerateActivityImages,
            body: "Stopping activity images generation before regeneration."
        });

        await sdevTasks.enqueue({
            userId: exportFilename,
            type: TaskType.GenerateActivityImages,
            body: "Generating activity route images."
        });

        const { pathname } = new URL(_req.url);
        const fullUrl = _req.url.replace(pathname, "");
        return Response.redirect(fullUrl + "/profile/activities");
    },
};

export const Activities = (props: PageProps<Props>) => <>
    <section>
        <form method="post" encType="multipart/form-data">
            <button type="submit" disabled={props.data.activityImagesStatus == "running"}>
                Regenerate Activity Images {props.data.activityImagesStatus == "running" ? ": Processing" : ""}
            </button>
        </form>
    </section>

    <h3>{props.data.activities?.length ?? 0} Activities</h3>
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
            {props.data.activities.map((activity: any) => <tr>
                <td>
                    <div class="thumbnail-frame">
                        {props.data.activityImageIds.includes(activity.activity_id) && <img
                            class="thumbnail-image"
                            src={`/activity-images/${activity.activity_id}.svg?v=${props.data.activityImageVersion}`}
                            alt={`Route for ${activity.activity_name}`}
                            loading="lazy"
                        />}
                        {!props.data.activityImageIds.includes(activity.activity_id) && <span class="thumbnail-placeholder">No map</span>}
                    </div>
                </td>
                <td>{activity.activity_type}</td>
                <td>{activity.activity_date}</td>
                <td><a href={`/training/activities/${activity.activity_id}`}>{activity.activity_name}</a></td>
                <td>{time.getHours(parseInt(activity.elapsed_time)) + 'h ' + time.getMinutes(parseInt(activity.elapsed_time)) + 'm ' + time.getSeconds(parseInt(activity.elapsed_time)) + 's'}</td>
                <td>{activity.distance + ' km'}</td>
                <td>{Math.floor(activity.elevation_gain) + 'ft'}</td>
            </tr>)}
        </tbody>
    </table>
</>

export default Activities

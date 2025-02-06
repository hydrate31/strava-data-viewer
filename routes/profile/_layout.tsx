import { Head } from "$fresh/runtime.ts";
import { FreshContext, PageProps, Handlers } from "$fresh/src/server/types.ts";
import sdevTasks from "../../packages/sdev.tasks/index.ts";
import { TaskType } from "../../packages/sdev.tasks/interfaces/task-type.ts";
import { StravaDataService } from "../../packages/strava.data.service/index.ts";
import { IClub } from "../../packages/strava.export-data-reader/interface/club.ts";
import { IFollow } from "../../packages/strava.export-data-reader/interface/follow.ts";
import { IMedia } from "../../packages/strava.export-data-reader/interface/media.ts";
import { IProfile } from "../../packages/strava.export-data-reader/interface/profile.ts";

interface Props {
    profile: IProfile
    media: IMedia[]
    followers: IFollow[]
    following: IFollow[]
    clubs: IClub[]
    heatmapStatus: string
}

export default async function Layout(req: Request, ctx: FreshContext) {
    const url = req.url;
    const folder = (ctx.state?.data as any)?.uid ?? 'export';
    const heatmapStatus = await sdevTasks.status(TaskType.GenerateHeatmap, folder);
    const activityStatus = await sdevTasks.status(TaskType.ProcessActivities, folder);

    const strava = new StravaDataService(folder);

    const profile = await strava.profile.get();
    const media = await strava.profile.getMedia();

    const { pathname } = new URL(req.url);

    // do something with state here
    return <>
        <Head>
            <title>{profile.first_name} {profile.last_name}: Profile</title>
        </Head>
        <ul class="media-header-grid">
            {media.slice(0, 6).map((media: any) => <li>
                <a href={`/${media.filename}`}>
                    <img src={`/${media.filename}`} alt={media.filename} />
                </a>
            </li>)}
        </ul>
        <div class="profile-page">
            <img src={'/media/avatar'} class="avatar-img" />

            <h1><a href={`https://www.strava.com/athletes/${profile.athelete_id}`}>{profile.first_name} {profile.last_name}</a></h1>
            <address>
                {profile.city + ", "}
                {profile.state + ", "}
                {profile.country + " "}
            </address>
            <p>{profile.description}</p>
            {/*<p>&lt;{profile.email}&gt;</p>*/}
            
            <nav role="tablist">
                <ul>
                    <li role="tab" selected={pathname == '/profile' ? true : undefined}>
                        <a href="/profile">
                            Overview
                        </a>
                    </li>
                    <li role="tab" selected={pathname == '/profile/activities' ? true : undefined}>
                        <a href="/profile/activities">
                            Activities {activityStatus  == "running" ? ": Processing" : ""}
                        </a>
                    </li>
                    <li role="tab" selected={pathname == '/profile/followers' ? true : undefined}>
                        <a href="/profile/followers">
                            Followers
                        </a>
                    </li>
                    <li role="tab" selected={pathname == '/profile/gear' ? true : undefined}>
                        <a href="/profile/gear">
                            Gear
                        </a>
                    </li>
                    <li role="tab" selected={pathname == '/profile/routes' ? true : undefined}>
                        <a href="/profile/routes">
                            Routes
                        </a>
                    </li>
                    <li role="tab" selected={pathname == '/profile/segments' ? true : undefined}>
                        <a href="/profile/segments">
                            Segments
                        </a>
                    </li>
                    <li role="tab" selected={pathname == '/profile/challenges' ? true : undefined}>
                        <a href="/profile/challenges">
                            Challenges &amp; Goals
                        </a>
                    </li>
                    <li>
                        <button class="primary" onClick={"window.location.href = '/heatmap'"}>
                        View Heatmap {heatmapStatus  == "running" ? ": Processing" : ""}
                    </button>
                    </li>
                    { ctx.state?.sessionId && <li>
                        <button onClick={"window.location.href = '/api/oauth/signout'"}>Logout</button>
                    </li> }
                </ul>
            </nav>

            <br />
            <ctx.Component />
        </div>
    </>
}
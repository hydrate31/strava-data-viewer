import { Head } from "$fresh/runtime.ts";
import { FreshContext, PageProps, Handlers } from "$fresh/src/server/types.ts";
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

        return ctx.render({
            activities,
            profile,
            media,
            followers,
            following,
            clubs
        });
    },
};

export const Activities = (props: PageProps<Props>) => <>
    <h3>{props.data.activities?.length ?? 0} Activities</h3>
    <table>
        <thead>
            <tr>
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
import { Head } from "$fresh/runtime.ts";
import { FreshContext, PageProps, Handlers } from "$fresh/src/server/types.ts";
import service from "../../packages/strava.data.service/index.ts";
import profile from "../../packages/strava.data.service/profile.ts";

interface Props {
    profile: Awaited<ReturnType<typeof service.profile.get>>
    media: Awaited<ReturnType<typeof service.profile.getMedia>>
    activities: Awaited<ReturnType<typeof service.activities.list>>
}

const time = {
    getSeconds: (seconds: number) => seconds % 60,
    getMinutes: (seconds: number) => Math.floor(seconds / 60) % 60,
    getHours: (seconds: number) => Math.floor(Math.floor(seconds / 60) / 60),
}
  
export const handler: Handlers<Props> = {
    async GET(_req: Request, ctx: FreshContext) {
        const profile = await service.profile.get();
        const media = await service.profile.getMedia();
        const activities = await service.activities.list();

        return ctx.render({
            profile,
            media,
            activities,
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
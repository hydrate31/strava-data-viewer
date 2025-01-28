import { Head } from "$fresh/runtime.ts";
import { FreshContext, PageProps, Handlers } from "$fresh/src/server/types.ts";
import service from "../../packages/strava.data.service/index.ts";

import dayjs from "npm:dayjs";

interface Props {
    activities: Awaited<ReturnType<typeof service.activities.list>>
}
  
export const handler: Handlers<Props> = {
    async GET(_req: Request, ctx: FreshContext) {
        const activities = await service.activities.list();

        return ctx.render({ activities });
    },
};

const time = {
    getSeconds: (seconds: number) => seconds % 60,
    getMinutes: (seconds: number) => Math.floor(seconds / 60) % 60,
    getHours: (seconds: number) => Math.floor(Math.floor(seconds / 60) / 60),
}


export const MyActivities = (props: PageProps<Props>) => <>
    <Head>
        <title>My Activities</title>
    </Head>
    <h2>My Activities</h2>
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

export default MyActivities
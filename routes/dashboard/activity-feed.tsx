import { Head } from "$fresh/runtime.ts";
import { FreshContext, PageProps, Handlers } from "$fresh/src/server/types.ts";
import { StravaDataService } from "../../packages/strava.data.service/index.ts";

interface Activities {
    activities: any[]
}
  
export const handler: Handlers<Activities> = {
    async GET(_req: Request, ctx: FreshContext) {
        const folder = (ctx.state?.data as any)?.uid ?? 'export';
        const strava = new StravaDataService(folder)

        const activities = await strava.activities.list();

        return ctx.render({ activities });
    },
};

const time = {
    getSeconds: (seconds: number) => seconds % 60,
    getMinutes: (seconds: number) => Math.floor(seconds / 60) % 60,
    getHours: (seconds: number) => Math.floor(Math.floor(seconds / 60) / 60),
}


export const ActivityFeed = (props: PageProps<Activities>) => <>
    <Head>
        <title>Activity Feed</title>
    </Head>
    <h2>Activity Feed</h2>
    <ol>
        {props.data.activities.map((activity: any) => <li>
            <h2>{activity.activity_name} </h2> 
            {activity.activity_date} <br /> 
            {activity.activity_type} <br /> 
            <strong>Distance:</strong> {activity.distance + ' km'} <br /> 
            <strong>Time: </strong>{
                time.getHours(parseInt(activity.elapsed_time)) + 'h ' + time.getMinutes(parseInt(activity.elapsed_time)) + 'm ' + time.getSeconds(parseInt(activity.elapsed_time)) + 's'
            } <br /> 
            <strong>Steps:</strong> {activity.total_steps} <br /> 
            <strong>Elev Gain:</strong> {Math.floor(activity.elevation_gain) + 'ft '}
        </li>)}
    </ol>
    
</>

export default ActivityFeed
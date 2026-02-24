import { Head } from "$fresh/runtime.ts";
import { FreshContext, Handlers, PageProps } from "$fresh/src/server/types.ts";
import { StravaDataService } from "../../packages/strava.data.service/index.ts";

import { IActivity } from "../../packages/strava.export-data-reader/interface/activity.ts";

interface Props {
  activities: IActivity[];
}

export const handler: Handlers<Props> = {
  async GET(_req: Request, ctx: FreshContext) {
    const folder = (ctx.state?.data as any)?.uid ?? "export";
    const strava = new StravaDataService(folder);
    const activities = await strava.activities.list();

    return ctx.render({ activities });
  },
};

const time = {
  getSeconds: (seconds: number) => seconds % 60,
  getMinutes: (seconds: number) => Math.floor(seconds / 60) % 60,
  getHours: (seconds: number) => Math.floor(Math.floor(seconds / 60) / 60),
};

export const MyActivities = (props: PageProps<Props>) => (
  <>
    <Head>
      <title>My Activities</title>
    </Head>
    <h2>My Activities</h2>
    <h3>{props.data.activities?.length ?? 0} Activities</h3>
    <div class="table-scroll">
      <table class="responsive-table">
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
          {props.data.activities.map((activity: any) => (
            <tr>
              <td data-label="Sport">{activity.activity_type}</td>
              <td data-label="Date">{activity.activity_date}</td>
              <td data-label="Title">
                <a href={`/training/activities/${activity.activity_id}`}>
                  {activity.activity_name}
                </a>
              </td>
              <td data-label="Time">
                {time.getHours(parseInt(activity.elapsed_time)) + "h " +
                  time.getMinutes(parseInt(activity.elapsed_time)) + "m " +
                  time.getSeconds(parseInt(activity.elapsed_time)) + "s"}
              </td>
              <td data-label="Distance">{activity.distance + " km"}</td>
              <td data-label="Elevation">
                {Math.floor(activity.elevation_gain) + "ft"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>
);

export default MyActivities;

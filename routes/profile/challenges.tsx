import { Head } from "$fresh/runtime.ts";
import { FreshContext, PageProps, Handlers } from "$fresh/src/server/types.ts";
import { StravaDataService } from "../../packages/strava.data.service/index.ts";
import { IActivity } from "../../packages/strava.export-data-reader/interface/activity.ts";
import { IClub } from "../../packages/strava.export-data-reader/interface/club.ts";
import { IFollow } from "../../packages/strava.export-data-reader/interface/follow.ts";
import { IMedia } from "../../packages/strava.export-data-reader/interface/media.ts";
import { IProfile } from "../../packages/strava.export-data-reader/interface/profile.ts";
import { IGlobalChallenge } from "../../packages/strava.export-data-reader/interface/global-challenges.ts";
import { IGroupChallenge } from "../../packages/strava.export-data-reader/interface/group-challenges.ts";
import { IGoal } from "../../packages/strava.export-data-reader/interface/goal.ts";

interface Props {
    activities: IActivity[]
    profile: IProfile
    media: IMedia[]
    followers: IFollow[]
    following: IFollow[]
    clubs: IClub[]
    goals: IGoal[]
    challenges: {
        global: IGlobalChallenge[],
        group: IGroupChallenge[],
    }
}
  
export const handler: Handlers<Props> = {
    async GET(_req: Request, ctx: FreshContext) {
        const folder = (ctx.state?.data as any)?.uid ?? 'export';
        const strava = new StravaDataService(folder)

        const profile = await strava.profile.get();
        const media = await strava.profile.getMedia();
        const global = await strava.profile.getGlobalChallenges();
        const group = await strava.profile.getGroupChallenges();
        const goals = await strava.profile.getGoals();

        return ctx.render({
            profile,
            media,
            goals,
            challenges: {
                global,
                group,
            }
        });
    },
};

export const Challenges = (props: PageProps<Props>) => <>
    <Head>
        <title>Challenges</title>
    </Head>

    <h3>Global</h3>
    {props.data.challenges.global.length > 0 && <table>
        <thead>
            <tr>
                <th>Join Date</th>
                <th>Name</th>
                <th>Completed</th>
            </tr>
        </thead>
        <tbody>
            {props.data.challenges.global.map((challenge: any) => <tr>
                <td>{challenge.join_date}</td>
                <td>{challenge.name}</td>
                <td>{challenge.completed}</td>
            </tr>)}
        </tbody>
    </table> }
    {props.data.challenges.global.length == 0 && <p>None</p>}
    <br />

    <h3>Group</h3>
    {props.data.challenges.group.length > 0 && <table>
        <thead>
            <tr>
                <th>Join Date</th>
                <th>Name</th>
                <th>Completed</th>
            </tr>
        </thead>
        <tbody>
            {props.data.challenges.group.map((challenge: any) => <tr>
                <td>{challenge.join_date}</td>
                <td>{challenge.name}</td>
                <td>{challenge.completed}</td>
            </tr>)}
        </tbody>
    </table> }
    {props.data.challenges.group.length == 0 && <p>None</p>} 
    <br />

    <h2>Goals</h2>
    {props.data.goals.length > 0 && <table>
        <thead>
            <tr>
                <th>Type</th>
                <th>Activity</th>
                <th>Goal</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Segment Id</th>
                {/*<th>Time Period</th>*/}
                <th>Interval Time</th>
            </tr>
        </thead>
        <tbody>
            {props.data.goals.map((goal: any) => <tr>
                <td>{goal.goal_type}</td>
                <td>{goal.activity_type}</td>
                <td>{goal.goal}</td>
                <td>{goal.start_date}</td>
                <td>{goal.end_date}</td>
                <td>{goal.segment_id}</td>
                {/*<td>{goal.time_period}</td>*/}
                <td>{goal.interval_time}</td>
            </tr>)}
        </tbody>
    </table> }
    {props.data.goals.length == 0 && <p>None</p>} 
</>

export default Challenges
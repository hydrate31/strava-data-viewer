import { Head } from "$fresh/runtime.ts";
import { FreshContext, PageProps, Handlers } from "$fresh/src/server/types.ts";
import service from "../../packages/strava.data.service/index.ts";

interface Props {
    profile: Awaited<ReturnType<typeof service.profile.get>>
    media: Awaited<ReturnType<typeof service.profile.getMedia>>
    goals: Awaited<ReturnType<typeof service.profile.getGoals>>,
    challenges: {
        global: Awaited<ReturnType<typeof service.profile.getGlobalChallenges>>,
        group: Awaited<ReturnType<typeof service.profile.getGroupChallenges>>,
    }
}
  
export const handler: Handlers<Props> = {
    async GET(_req: Request, ctx: FreshContext) {
        const profile = await service.profile.get();
        const media = await service.profile.getMedia();
        const goals = await service.profile.getGoals();
        const global = await service.profile.getGlobalChallenges();
        const group = await service.profile.getGroupChallenges();

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
                <th>Start Date</th>
                <th>End Date</th>
                <th>Segment Id</th>
                <th>Time Period</th>
                <th>Interval Time</th>
            </tr>
        </thead>
        <tbody>
            {props.data.goals.map((goal: any) => <tr>
                <td>{goal.goal_type}</td>
                <td>{goal.activity_type}</td>
                <td>{goal.start_date}</td>
                <td>{goal.end_date}</td>
                <td>{goal.segment_id}</td>
                <td>{goal.time_period}</td>
                <td>{goal.interval_time}</td>
            </tr>)}
        </tbody>
    </table> }
    {props.data.goals.length == 0 && <p>None</p>} 
</>

export default Challenges
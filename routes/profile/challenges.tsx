import { Head } from "$fresh/runtime.ts";
import { FreshContext, Handlers, PageProps } from "$fresh/src/server/types.ts";
import { StravaDataService } from "../../packages/strava.data.service/index.ts";
import { IActivity } from "../../packages/strava.export-data-reader/interface/activity.ts";
import { IClub } from "../../packages/strava.export-data-reader/interface/club.ts";
import { IFollow } from "../../packages/strava.export-data-reader/interface/follow.ts";
import { IMedia } from "../../packages/strava.export-data-reader/interface/media.ts";
import { IProfile } from "../../packages/strava.export-data-reader/interface/profile.ts";
import { IGlobalChallenge } from "../../packages/strava.export-data-reader/interface/global-challenges.ts";
import { IGroupChallenge } from "../../packages/strava.export-data-reader/interface/group-challenges.ts";
import { IGoal } from "../../packages/strava.export-data-reader/interface/goal.ts";
import StatePanel from "../../components/StatePanel.tsx";

interface Props {
  activities: IActivity[];
  profile: IProfile;
  media: IMedia[];
  followers: IFollow[];
  following: IFollow[];
  clubs: IClub[];
  goals: IGoal[];
  challenges: {
    global: IGlobalChallenge[];
    group: IGroupChallenge[];
  };
}

export const handler: Handlers<Props> = {
  async GET(_req: Request, ctx: FreshContext) {
    const folder = (ctx.state?.data as any)?.uid ?? "export";
    const strava = new StravaDataService(folder);

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
      },
    });
  },
};

export const Challenges = (props: PageProps<Props>) => (
  <>
    <Head>
      <title>Challenges</title>
    </Head>

    <h3>Global</h3>
    {props.data.challenges.global.length > 0 && (
      <div class="table-scroll">
        <table class="responsive-table">
          <thead>
            <tr>
              <th>Join Date</th>
              <th>Name</th>
              <th>Completed</th>
            </tr>
          </thead>
          <tbody>
            {props.data.challenges.global.map((challenge: any) => (
              <tr>
                <td data-label="Join Date">{challenge.join_date}</td>
                <td data-label="Name">{challenge.name}</td>
                <td data-label="Completed">{challenge.completed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
    {props.data.challenges.global.length == 0 && (
      <StatePanel
        title="No global challenges found"
        description="No global challenge rows were found in this export."
        actions={[
          { href: "/upload", label: "Re-import data", primary: true },
          { href: "/profile/activities", label: "View activities" },
        ]}
      />
    )}
    <br />

    <h3>Group</h3>
    {props.data.challenges.group.length > 0 && (
      <div class="table-scroll">
        <table class="responsive-table">
          <thead>
            <tr>
              <th>Join Date</th>
              <th>Name</th>
              <th>Completed</th>
            </tr>
          </thead>
          <tbody>
            {props.data.challenges.group.map((challenge: any) => (
              <tr>
                <td data-label="Join Date">{challenge.join_date}</td>
                <td data-label="Name">{challenge.name}</td>
                <td data-label="Completed">{challenge.completed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
    {props.data.challenges.group.length == 0 && (
      <StatePanel
        title="No group challenges found"
        description="No group challenge rows were found in this export."
        actions={[
          { href: "/upload", label: "Re-import data", primary: true },
          { href: "/profile/activities", label: "View activities" },
        ]}
      />
    )}
    <br />

    <h2>Goals</h2>
    {props.data.goals.length > 0 && (
      <div class="table-scroll">
        <table class="responsive-table">
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
            {props.data.goals.map((goal: any) => (
              <tr>
                <td data-label="Type">{goal.goal_type}</td>
                <td data-label="Activity">{goal.activity_type}</td>
                <td data-label="Goal">{goal.goal}</td>
                <td data-label="Start Date">{goal.start_date}</td>
                <td data-label="End Date">{goal.end_date}</td>
                <td data-label="Segment Id">{goal.segment_id}</td>
                {/*<td>{goal.time_period}</td>*/}
                <td data-label="Interval Time">{goal.interval_time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
    {props.data.goals.length == 0 && (
      <StatePanel
        title="No goals found"
        description="No goal records are currently available in this export."
        actions={[
          { href: "/upload", label: "Re-import data", primary: true },
          { href: "/profile/stats", label: "Open stats" },
        ]}
      />
    )}
  </>
);

export default Challenges;

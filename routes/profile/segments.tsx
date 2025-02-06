import { Head } from "$fresh/runtime.ts";
import { FreshContext, PageProps, Handlers } from "$fresh/src/server/types.ts";
import { StravaDataService } from "../../packages/strava.data.service/index.ts";
import { IMedia } from "../../packages/strava.export-data-reader/interface/media.ts";
import { IProfile } from "../../packages/strava.export-data-reader/interface/profile.ts";
import { IGoal } from "../../packages/strava.export-data-reader/interface/goal.ts";
import { ISegment } from "../../packages/strava.export-data-reader/interface/segment.ts";

interface Props {
    profile: IProfile
    media: IMedia[]
    goals: IGoal[]
    segments: ISegment[]
}
  
export const handler: Handlers<Props> = {
    async GET(_req: Request, ctx: FreshContext) {
        const folder = (ctx.state?.data as any)?.uid ?? 'export';
        const strava = new StravaDataService(folder)
    
        const profile = await strava.profile.get();
        const media = await strava.profile.getMedia();
        const goals = await strava.profile.getGoals();
        const segments = await strava.segments.list();

        return ctx.render({
            profile,
            media,
            goals,
            segments
        });
    },
};

export const Segments = (props: PageProps<Props>) => <>
    <Head>
        <title>Segments</title>
    </Head>
    
    {props.data.segments.length > 0 && <table>
        <thead>
            <tr>
                <th>Name</th>
                <th>Starting Position</th>
                <th>Finish Position</th>
            </tr>
        </thead>
        <tbody>
            {props.data.segments.map((segment: any) => <tr>
                <td>{segment.join_date}</td>
                <td>[{segment.starting_latitude}, {segment.starting_longitude}]</td>
                <td>[{segment.ending_latitude}, {segment.ending_longitude}]</td>
            </tr>)}
        </tbody>
    </table> }
    {props.data.segments.length == 0 && <p>None</p>}
   
</>

export default Segments
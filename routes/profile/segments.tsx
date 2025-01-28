import { Head } from "$fresh/runtime.ts";
import { FreshContext, PageProps, Handlers } from "$fresh/src/server/types.ts";
import service from "../../packages/strava.data.service/index.ts";

interface Props {
    profile: Awaited<ReturnType<typeof service.profile.get>>
    media: Awaited<ReturnType<typeof service.profile.getMedia>>
    goals: Awaited<ReturnType<typeof service.profile.getGoals>>,
    segments: Awaited<ReturnType<typeof service.segments.list>>,
}
  
export const handler: Handlers<Props> = {
    async GET(_req: Request, ctx: FreshContext) {
        const profile = await service.profile.get();
        const media = await service.profile.getMedia();
        const goals = await service.profile.getGoals();
        const segments = await service.segments.list();

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
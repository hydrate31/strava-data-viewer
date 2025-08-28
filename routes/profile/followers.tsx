import { FreshContext, PageProps, Handlers } from "$fresh/src/server/types.ts";
import sdevTasks from "../../packages/sdev.tasks/index.ts";
import { QueueEntry } from "../../packages/sdev.tasks/interfaces/queue-entry.ts";
import { TaskType } from "../../packages/sdev.tasks/interfaces/task-type.ts";
import { StravaDataService } from "../../packages/strava.data.service/index.ts";
import { IFollow } from "../../packages/strava.export-data-reader/interface/follow.ts";
import { IMedia } from "../../packages/strava.export-data-reader/interface/media.ts";
import { IProfile } from "../../packages/strava.export-data-reader/interface/profile.ts";
import { IAthlete } from "../../packages/strava.wget.service/athletes.ts";

interface Props {
    athletes: IAthlete[]
    profile: IProfile
    media: IMedia[]
    followers: IFollow[]
    following: IFollow[]
}

  
export const handler: Handlers<Props> = {
    async GET(_req: Request, ctx: FreshContext) {
        const folder = (ctx.state?.data as any)?.uid ?? 'export';
        const strava = new StravaDataService(folder)

        const athletes = await strava.athletes.list();
        const profile = await strava.profile.get();
        const media = await strava.profile.getMedia();
        const followers = await strava.profile.getFollowers();
        const following = await strava.profile.getFollowing();
        const clubs = await strava.profile.getClubs();
        
        return ctx.render({
            athletes,
            profile,
            media,
            followers,
            following,
            clubs
        });
    },


    async POST(_req: Request, ctx: FreshContext) {
        const form = await _req.formData();
        const exportFilename = (ctx.state?.data as any)?.uid ?? 'export';

        if (await sdevTasks.status(TaskType.ProcessAthletes, exportFilename) !== "running") {
            sdevTasks.enqueue({
                userId: exportFilename,
                type: TaskType.ProcessAthletes,
                body: "Fetching athelete information..."
            } as QueueEntry);
        }


        const folder = (ctx.state?.data as any)?.uid ?? 'export';
        const strava = new StravaDataService(folder)

        const athletes = await strava.athletes.list();
        const profile = await strava.profile.get();
        const media = await strava.profile.getMedia();
        const followers = await strava.profile.getFollowers();
        const following = await strava.profile.getFollowing();
        const clubs = await strava.profile.getClubs();

        return ctx.render({
            athletes,
            profile,
            media,
            followers,
            following,
            clubs
        });
    }
};

export const Followers = (props: PageProps<Props>) => <>
    <section>
        <form method="POST">
            <button>Re-process Athletes</button>
        </form>
        <h3>Following</h3>
        {props.data.following.length > 0 && <table>
            <thead>
                <tr>
                    <th>Athelete</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                {props.data.following.map((follow: any) => <tr>
                    <td>
                        <img src={props.data.athletes?.find(entry => entry.id == follow.athelete_id)?.avatarUrl} style="height: 1em; width: 1em; vertical align-bottom;" />
                        <a href={`https://www.strava.com/athletes/${follow.athelete_id}`}>{
                            props.data.athletes?.find(entry => entry.id == follow.athelete_id)?.name ?? follow.athelete_id
                        }</a>
                    </td>
                    <td title={follow.created_at}>
                        <button disabled>{follow.status == 'Accepted' ? 'Follow Requested' : 'Following'}</button>
                    </td>
                </tr>)}
            </tbody>
        </table> }
        {props.data.following.length == 0 && <p>None</p>}
        <br />
    
        <h3>Followers</h3>

        {props.data.followers.length > 0 && <table>
            <thead>
                <tr>
                    <th>Athelete</th>
                </tr>
            </thead>
            <tbody>
                {props.data.followers.map((follow: any) => <tr>
                    <td>
                        <img src={props.data.athletes?.find(entry => entry.id == follow.athelete_id)?.avatarUrl} style="height: 1em; width: 1em; vertical align-bottom;" />
                        <a href={`https://www.strava.com/athletes/${follow.athelete_id}`}>{
                            props.data.athletes?.find(entry => entry.id == follow.athelete_id)?.name ?? follow.athelete_id
                        }</a>
                    </td>
                </tr>)}
            </tbody>
        </table> }
        {props.data.followers.length == 0 && <p>None</p>} 
    </section>
</>

export default Followers
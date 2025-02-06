import { FreshContext, PageProps, Handlers } from "$fresh/src/server/types.ts";
import { StravaDataService } from "../../packages/strava.data.service/index.ts";
import { IFollow } from "../../packages/strava.export-data-reader/interface/follow.ts";
import { IMedia } from "../../packages/strava.export-data-reader/interface/media.ts";
import { IProfile } from "../../packages/strava.export-data-reader/interface/profile.ts";

interface Props {
    profile: IProfile
    media: IMedia[]
    followers: IFollow[]
    following: IFollow[]
}
  
export const handler: Handlers<Props> = {
    async GET(_req: Request, ctx: FreshContext) {
        const folder = (ctx.state?.data as any)?.uid ?? 'export';
        const strava = new StravaDataService(folder)

        const profile = await strava.profile.get();
        const media = await strava.profile.getMedia();
        const followers = await strava.profile.getFollowers();
        const following = await strava.profile.getFollowing();
        const clubs = await strava.profile.getClubs();

        return ctx.render({
            profile,
            media,
            followers,
            following,
            clubs
        });
    },
};

export const Followers = (props: PageProps<Props>) => <>
    <section>
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
                    <td><a href={`https://www.strava.com/athletes/${follow.athelete_id}`}>{follow.athelete_id}</a></td>
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
                    <td><a href={`https://www.strava.com/athletes/${follow.athelete_id}`}>{follow.athelete_id}</a></td>
                </tr>)}
            </tbody>
        </table> }
        {props.data.followers.length == 0 && <p>None</p>} 
    </section>
</>

export default Followers
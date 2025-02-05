import { FreshContext, PageProps, Handlers } from "$fresh/src/server/types.ts";
import service from "../../packages/strava.data.service/index.ts";

interface Props {
    profile: Awaited<ReturnType<typeof service.profile.get>>
    media: Awaited<ReturnType<typeof service.profile.getMedia>>
    followers: Awaited<ReturnType<typeof service.profile.getFollowers>>
    following: Awaited<ReturnType<typeof service.profile.getFollowing>>
}
  
export const handler: Handlers<Props> = {
    async GET(_req: Request, ctx: FreshContext) {
        const profile = await service.profile.get();
        const media = await service.profile.getMedia();
        const followers = await service.profile.getFollowers();
        const following = await service.profile.getFollowing();

        return ctx.render({
            profile,
            media,
            followers,
            following,
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
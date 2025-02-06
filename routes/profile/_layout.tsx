import { Head } from "$fresh/runtime.ts";
import { FreshContext, PageProps, Handlers } from "$fresh/src/server/types.ts";
import { StravaDataService } from "../../packages/strava.data.service/index.ts";
import { IClub } from "../../packages/strava.export-data-reader/interface/club.ts";
import { IFollow } from "../../packages/strava.export-data-reader/interface/follow.ts";
import { IMedia } from "../../packages/strava.export-data-reader/interface/media.ts";
import { IProfile } from "../../packages/strava.export-data-reader/interface/profile.ts";

interface Props {
    profile: IProfile
    media: IMedia[]
    followers: IFollow[]
    following: IFollow[]
    clubs: IClub[]
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
export default function Layout({ Component, state, data, url }: PageProps<Props>) {
    
    // do something with state here
    return <>
        <Head>
            <title>{data.profile.first_name} {data.profile.last_name}: Profile</title>
        </Head>
        <ul class="media-header-grid">
            {data.media.slice(0, 6).map((media: any) => <li>
                <a href={`/${media.filename}`}>
                    <img src={`/${media.filename}`} alt={media.filename} />
                </a>
            </li>)}
        </ul>
        <div class="profile-page">
            <img src={'/media/avatar'} class="avatar-img" />

            <h1><a href={`https://www.strava.com/athletes/${data.profile.athelete_id}`}>{data.profile.first_name} {data.profile.last_name}</a></h1>
            <address>
                {data.profile.city + ", "}
                {data.profile.state + ", "}
                {data.profile.country + " "}
            </address>
            <p>{data.profile.description}</p>
            {/*<p>&lt;{data.profile.email}&gt;</p>*/}
            
            <nav role="tablist">
                <ul>
                    <li role="tab" selected={url.pathname == '/profile' ? true : undefined}>
                        <a href="/profile">
                            Overview
                        </a>
                    </li>
                    <li role="tab" selected={url.pathname == '/profile/activities' ? true : undefined}>
                        <a href="/profile/activities">
                            Activities
                        </a>
                    </li>
                    <li role="tab" selected={url.pathname == '/profile/followers' ? true : undefined}>
                        <a href="/profile/followers">
                            Followers
                        </a>
                    </li>
                    <li role="tab" selected={url.pathname == '/profile/gear' ? true : undefined}>
                        <a href="/profile/gear">
                            Gear
                        </a>
                    </li>
                    <li role="tab" selected={url.pathname == '/profile/routes' ? true : undefined}>
                        <a href="/profile/routes">
                            Routes
                        </a>
                    </li>
                    <li role="tab" selected={url.pathname == '/profile/segments' ? true : undefined}>
                        <a href="/profile/segments">
                            Segments
                        </a>
                    </li>
                    <li role="tab" selected={url.pathname == '/profile/challenges' ? true : undefined}>
                        <a href="/profile/challenges">
                            Challenges &amp; Goals
                        </a>
                    </li>
                    <li>
                        <button class="primary" onClick={"window.location.href = '/heatmap'"}>View Heatmap</button>
                    </li>
                    { state?.sessionId && <li>
                        <button onClick={"window.location.href = '/api/oauth/signout'"}>Logout</button>
                    </li> }
                </ul>
            </nav>

            <br />
            <Component />
        </div>
    </>
}
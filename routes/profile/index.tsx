import { FreshContext, PageProps, Handlers } from "$fresh/src/server/types.ts";
import { StravaDataService } from "../../packages/strava.data.service/index.ts";
import { IClub } from "../../packages/strava.export-data-reader/interface/club.ts";
import { IMedia } from "../../packages/strava.export-data-reader/interface/media.ts";
import { IProfile } from "../../packages/strava.export-data-reader/interface/profile.ts";

interface Props {
    profile: IProfile
    media: IMedia[]
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

export const Overview = (props: PageProps<Props>) => <>
    {/*<form>
        <label for="sex">
            Sex
        </label>
        <select name="sex" disabled>
            <option>{props.data.profile.sex}</option> 
        </select>
        <br />

        <label for="weight">
            Weight
        </label>
        <input type="text" name="weight" value={props.data.profile.weight} disabled />
        <br />

        <input type="checkbox" name="health_consent_status" checked={props.data.profile.health_consent_status == "Approved" ? true : false} disabled />
        <label for="health_consent_status">
            Health Consent Status (given on {props.data.profile.date_of_health_consent_status})
        </label>
    </form> */}

    <section>
        { props.data.clubs.length && <>
            <h3>Clubs</h3>
            <ul class="clubs-list">
                {props.data.clubs.map(club => <li>
                    <a href={club.website}>
                        <figure>
                            <img src={`/${club.profile_photo}`} />
                            <figcaption>{club.name}</figcaption>
                        </figure>
                    </a>
                </li> )}
            </ul>
        </>}
        
        <h3>Events</h3>
    </section>

    <section>
        <h3>Photos ({props.data.media.length})</h3>
        <ol class="media-list">
            {props.data.media.map((media: any) => <li>
                <a href={`/${media.filename}`}>
                    <img src={`/${media.filename}`} alt={media.filename} />
                </a>
            </li>)}
        </ol>
    </section>
</>

export default Overview
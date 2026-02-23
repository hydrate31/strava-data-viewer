import { FreshContext, PageProps, Handlers } from "$fresh/src/server/types.ts";
import { TaskType } from "../../packages/sdev.tasks/interfaces/task-type.ts";
import { StravaDataService } from "../../packages/strava.data.service/index.ts";
import { IBlock } from "../../packages/strava.export-data-reader/interface/block.ts";
import { IClub } from "../../packages/strava.export-data-reader/interface/club.ts";
import { IComment } from "../../packages/strava.export-data-reader/interface/comment.ts";
import { IEvent } from "../../packages/strava.export-data-reader/interface/event.ts";
import { IMedia } from "../../packages/strava.export-data-reader/interface/media.ts";
import { IProfile } from "../../packages/strava.export-data-reader/interface/profile.ts";
import sdevTasks from "../../packages/sdev.tasks/index.ts";

interface Props {
    profile: IProfile
    media: IMedia[]
    clubs: IClub[]
    events: IEvent[]
    comments: IComment[]
    blocks: IBlock[]
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
        const events = await strava.profile.getEvents();
        const comments = await strava.profile.getComments();
        const blocks = await strava.profile.getBlocks();

        return ctx.render({
            profile,
            media,
            followers,
            following,
            clubs,
            events,
            comments,
            blocks,
        });
    },

    async POST(_req: Request, ctx: FreshContext) {
        const exportFilename = (ctx.state?.data as any)?.uid ?? 'export';
        console.log("POST: Profile")

        await sdevTasks.forceStop({
            userId: exportFilename,
            type: TaskType.GenerateHeatmap,
            body: "Stopping heatmap before regeneration."
        });

        await sdevTasks.enqueue({
            userId: exportFilename,
            type: TaskType.GenerateHeatmap,
            body: "Generating new heatmap."
        });

        const { pathname } = new URL(_req.url);
        const fullUrl = _req.url.replace(pathname, "")
        return Response.redirect(fullUrl + "/profile")
    }
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
        <form method="post" encType="multipart/form-data">
            <button type="submit">Regenerate Heatmap</button>
        </form>
    </section>

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
        {props.data.events.length > 0 && <table>
            <thead>
                <tr>
                    <th>Title</th>
                    <th>Description</th>
                    <th>Start Time</th>
                </tr>
            </thead>
            <tbody>
                {props.data.events.map(event => <tr>
                    <td>{event.title}</td>
                    <td>{event.description}</td>
                    <td>{event.start_time}</td>
                </tr>)}
            </tbody>
        </table>}
        {props.data.events.length == 0 && <p>None</p>}
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

    <section>
        <h3>Comments</h3>
        {props.data.comments.length > 0 && <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Comment</th>
                </tr>
            </thead>
            <tbody>
                {props.data.comments.map((comment) => <tr>
                    <td>{comment.comment_date}</td>
                    <td>{comment.comment}</td>
                </tr>)}
            </tbody>
        </table>}
        {props.data.comments.length == 0 && <p>None</p>}
    </section>

    <section>
        <h3>Blocks</h3>
        {props.data.blocks.length > 0 && <table>
            <thead>
                <tr>
                    <th>Athlete ID</th>
                    <th>Created At</th>
                </tr>
            </thead>
            <tbody>
                {props.data.blocks.map((block) => <tr>
                    <td>{block.athlete_id}</td>
                    <td>{block.created_at}</td>
                </tr>)}
            </tbody>
        </table>}
        {props.data.blocks.length == 0 && <p>None</p>}
    </section>
</>

export default Overview

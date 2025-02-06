import { Head } from "$fresh/runtime.ts";
import { FreshContext, PageProps, Handlers } from "$fresh/src/server/types.ts";
import { StravaDataService } from "../../packages/strava.data.service/index.ts";
import { IMedia } from "../../packages/strava.export-data-reader/interface/media.ts";
import { IProfile } from "../../packages/strava.export-data-reader/interface/profile.ts";
import { IRoute } from "../../packages/strava.export-data-reader/interface/route.ts";

interface Props {
    profile: IProfile
    media: IMedia[]
    routes: IRoute[]
}
  
export const handler: Handlers<Props> = {
    async GET(_req: Request, ctx: FreshContext) {
        const folder = (ctx.state?.data as any)?.uid ?? 'export';
        const strava = new StravaDataService(folder)
    
        const profile = await strava.profile.get();
        const media = await strava.profile.getMedia();
        const routes = await strava.routes.list();

        return ctx.render({
            profile,
            media,
            routes,
        });
    },
};

export const Routes = ({ data }: PageProps<Props>) => <>
    <Head>
        <title>Routes</title>
    </Head>
    <table>
        <thead>
            <tr>
                <th>Name</th>
                <th>File</th>
            </tr>
        </thead>
        <tbody>
            {data.routes.map(route => <tr>
                <td><a href={`/routes/${route.filename.replace("routes/", "").replace(".gpx", "")}`}>{route.name}</a></td>
                <td>{route.filename}</td>
            </tr>)}
        </tbody>
    </table>
</>

export default Routes
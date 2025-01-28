import { Head } from "$fresh/runtime.ts";
import { FreshContext, PageProps, Handlers } from "$fresh/src/server/types.ts";
import service from "../../packages/strava.data.service/index.ts";
import profile from "../../packages/strava.data.service/profile.ts";

interface Props {
    profile: Awaited<ReturnType<typeof service.profile.get>>
    media: Awaited<ReturnType<typeof service.profile.getMedia>>
    routes: Awaited<ReturnType<typeof service.routes.list>>
}
  
export const handler: Handlers<Props> = {
    async GET(_req: Request, ctx: FreshContext) {
        const profile = await service.profile.get();
        const media = await service.profile.getMedia();
        const routes = await service.routes.list();

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
    <h2>My Routes</h2>
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
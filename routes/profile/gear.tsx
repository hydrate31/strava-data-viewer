import { FreshContext, PageProps, Handlers } from "$fresh/src/server/types.ts";
import service from "../../packages/strava.data.service/index.ts";
import profile from "../../packages/strava.data.service/profile.ts";

interface Props {
    profile: Awaited<ReturnType<typeof service.profile.get>>
    media: Awaited<ReturnType<typeof service.profile.getMedia>>
    bikes: Awaited<ReturnType<typeof service.gear.bikes>>
    components: Awaited<ReturnType<typeof service.gear.components>>
    shoes: Awaited<ReturnType<typeof service.gear.shoes>>
}
  
export const handler: Handlers<Props> = {
    async GET(_req: Request, ctx: FreshContext) {
        const profile = await service.profile.get();
        const media = await service.profile.getMedia();
        const bikes = await service.gear.bikes();
        const components = await service.gear.components();
        const shoes = await service.gear.shoes();

        return ctx.render({
            profile,
            media,
            bikes,
            components,
            shoes,
        });
    },
};

export const Gear = ({ data }: PageProps<Props>) => <>
    <h1>My Gear</h1>

    <section>
        <h2>My Bikes</h2>
        <table>
            <thead>
                <tr>
                    <th>Nickname</th>
                    <th>Brand</th>
                    <th>Model</th>
                    <th>Type</th>
                </tr>
            </thead>
            <tbody>
                {data.bikes.map(bike => <tr>
                    <td>{bike.name}</td>
                    <td>{bike.brand}</td>
                    <td>{bike.model}</td>
                    <td>{bike.default_sport_types}</td>
                </tr>)}
            </tbody>
        </table>
    </section>
    <br />

    <section>
        <h2>My Shoes</h2>
        <table>
            <thead>
                <tr>
                    <th>Nickname</th>
                    <th>Brand</th>
                    <th>Model</th>
                    <th>Type</th>
                </tr>
            </thead>
            <tbody>
                {data.shoes.map(shoe => <tr>
                    <td>{shoe.name}</td>
                    <td>{shoe.brand}</td>
                    <td>{shoe.model}</td>
                    <td>{shoe.default_sport_types}</td>
                </tr>)}
            </tbody>
        </table>
    </section>
</>

export default Gear
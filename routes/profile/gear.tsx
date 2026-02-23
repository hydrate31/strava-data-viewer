import { FreshContext, PageProps, Handlers } from "$fresh/src/server/types.ts";
import { StravaDataService } from "../../packages/strava.data.service/index.ts";
import { IBike } from "../../packages/strava.export-data-reader/interface/bike.ts";
import { IComponent } from "../../packages/strava.export-data-reader/interface/component.ts";
import { IMedia } from "../../packages/strava.export-data-reader/interface/media.ts";
import { IProfile } from "../../packages/strava.export-data-reader/interface/profile.ts";
import { IShoe } from "../../packages/strava.export-data-reader/interface/shoe.ts";

interface Props {
    profile: IProfile
    media: IMedia[]
    bikes: IBike[]
    components: IComponent[]
    shoes: IShoe[]
}
  
export const handler: Handlers<Props> = {
    async GET(_req: Request, ctx: FreshContext) {
        const folder = (ctx.state?.data as any)?.uid ?? 'export';
        const strava = new StravaDataService(folder)

        const profile = await strava.profile.get();
        const media = await strava.profile.getMedia();
        
        const bikes = await strava.gear.bikes();
        const components = await strava.gear.components();
        const shoes = await strava.gear.shoes();

        return ctx.render({
            profile,
            media,
            bikes,
            components,
            shoes
        });
    },
};

export const Gear = ({ data }: PageProps<Props>) => <>
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
        <h2>My Components</h2>
        {data.components.length > 0 && <table>
            <thead>
                <tr>
                    <th>Bike</th>
                    <th>Type</th>
                    <th>Brand</th>
                    <th>Model</th>
                </tr>
            </thead>
            <tbody>
                {data.components.map(component => <tr>
                    <td>{component.bike_name}</td>
                    <td>{component.type}</td>
                    <td>{component.brand}</td>
                    <td>{component.model}</td>
                </tr>)}
            </tbody>
        </table>}
        {data.components.length == 0 && <p>None</p>}
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

import { FreshContext, Handlers, PageProps } from "$fresh/src/server/types.ts";
import { StravaDataService } from "../../packages/strava.data.service/index.ts";
import { IBike } from "../../packages/strava.export-data-reader/interface/bike.ts";
import { IComponent } from "../../packages/strava.export-data-reader/interface/component.ts";
import { IMedia } from "../../packages/strava.export-data-reader/interface/media.ts";
import { IProfile } from "../../packages/strava.export-data-reader/interface/profile.ts";
import { IShoe } from "../../packages/strava.export-data-reader/interface/shoe.ts";

interface Props {
  profile: IProfile;
  media: IMedia[];
  bikes: IBike[];
  components: IComponent[];
  shoes: IShoe[];
}

export const handler: Handlers<Props> = {
  async GET(_req: Request, ctx: FreshContext) {
    const folder = (ctx.state?.data as any)?.uid ?? "export";
    const strava = new StravaDataService(folder);

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
      shoes,
    });
  },
};

export const Gear = ({ data }: PageProps<Props>) => (
  <>
    <section>
      <h2>My Bikes</h2>
      <div class="table-scroll">
        <table class="responsive-table">
          <thead>
            <tr>
              <th>Nickname</th>
              <th>Brand</th>
              <th>Model</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {data.bikes.map((bike) => (
              <tr>
                <td data-label="Nickname">{bike.name}</td>
                <td data-label="Brand">{bike.brand}</td>
                <td data-label="Model">{bike.model}</td>
                <td data-label="Type">{bike.default_sport_types}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
    <br />

    <section>
      <h2>My Components</h2>
      {data.components.length > 0 && (
        <div class="table-scroll">
          <table class="responsive-table">
            <thead>
              <tr>
                <th>Bike</th>
                <th>Type</th>
                <th>Brand</th>
                <th>Model</th>
              </tr>
            </thead>
            <tbody>
              {data.components.map((component) => (
                <tr>
                  <td data-label="Bike">{component.bike_name}</td>
                  <td data-label="Type">{component.type}</td>
                  <td data-label="Brand">{component.brand}</td>
                  <td data-label="Model">{component.model}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.components.length == 0 && <p>None</p>}
    </section>
    <br />

    <section>
      <h2>My Shoes</h2>
      <div class="table-scroll">
        <table class="responsive-table">
          <thead>
            <tr>
              <th>Nickname</th>
              <th>Brand</th>
              <th>Model</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {data.shoes.map((shoe) => (
              <tr>
                <td data-label="Nickname">{shoe.name}</td>
                <td data-label="Brand">{shoe.brand}</td>
                <td data-label="Model">{shoe.model}</td>
                <td data-label="Type">{shoe.default_sport_types}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  </>
);

export default Gear;

import { Head } from "$fresh/runtime.ts";
import { FreshContext, PageProps, Handlers } from "$fresh/src/server/types.ts";
import service from "../../../packages/strava.data.service/index.ts";

type Props = {
    mapData: string
    profile: Awaited<ReturnType<typeof service.profile.get>>
} & Awaited<ReturnType<typeof service.activities.get>>
  
export const handler: Handlers<Props> = {
    async GET(_req: Request, ctx: FreshContext) {
        const { activity, geoJson } = await service.activities.get(ctx.params.slug);
                const profile = await service.profile.get();

        const mapData = `
            // Creating map options
            var mapOptions = {
                center: [53.9690089, -2.6276908],
                zoom: 8
            }
            
            // Creating a map object
            var map = new L.map('map', mapOptions);
            
            // Creating a Layer object
            var layer = new L.TileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
            
            // Adding layer to the map
            map.addLayer(layer);
            console.log({ ...L })


            var jsonLayer = L.geoJson(${geoJson}, {
                style: function (feature) {
                    return {color: 'blue'};
                }
            }).addTo(map);
            map.fitBounds(jsonLayer.getBounds());
        `

        return ctx.render({ profile, activity, mapData });
    },
};

const time = {
    getSeconds: (seconds: number) => seconds % 60,
    getMinutes: (seconds: number) => Math.floor(seconds / 60) % 60,
    getHours: (seconds: number) => Math.floor(Math.floor(seconds / 60) / 60),
}


export const Activity = ({ data }: PageProps<Props>) => <>
    <Head>
        <title>{data.activity.activity_name}</title>
        <link rel = "stylesheet" href = "http://cdn.leafletjs.com/leaflet-0.7.3/leaflet.css"/>
        <script src = "http://cdn.leafletjs.com/leaflet-0.7.3/leaflet.js"></script>
    </Head>
    <details open>
        <summary>
            <h1>{data.profile.first_name} {data.profile.last_name} - {data.activity.activity_type}</h1>
        </summary>
        <section class="header">
            <time>{data.activity.activity_date}</time>
            <h2>{data.activity.activity_name}</h2>
            {data.activity.activity_description != '' ? <p>{data.activity.activity_description}</p> : <button disabled>No description</button>}
        </section>
        <section class="details">
            
        </section>
    </details>

    <section class="map">
        <div id="map" style="width: 100%; height: 24rem; display: inline-block;"></div>
        <script dangerouslySetInnerHTML={{ __html: data.mapData }} defer></script>
    </section>
   
    {data.activity.activity_description ?? <button>Add a description</button>}
    {data.activity.activity_private_note ?? <button>Add a private notes</button>}

    <section>
        <p>distance: {data.activity.distance} km</p>
        <p>moving time: {data.activity.moving_time}</p>
        <p>elevation: {data.activity.elevation_gain} m</p>

        <h3>Speed</h3>
        <p>max: {data.activity.max_speed} kmh</p>
        <p>average: {data.activity.average_speed} kmh</p>
        
        <p>calories: {data.activity.calories}</p>
        <p>elapsed time: {data.activity.elapsed_time}</p>
    </section>
</>

export default Activity
import { Head } from "$fresh/runtime.ts";
import { FreshContext, PageProps, Handlers } from "$fresh/src/server/types.ts";
import { StravaDataService } from "../../packages/strava.data.service/index.ts";
import { IRoute } from "../../packages/strava.export-data-reader/interface/route.ts";

type Props = {
    mapData: string
    routes: IRoute[]
    route: IRoute
}
  
export const handler: Handlers<Props> = {
    async GET(_req: Request, ctx: FreshContext) {
        const folder = (ctx.state?.data as any)?.uid ?? 'export';
        const strava = new StravaDataService(folder)

        const routes = await strava.routes.list();
        const route = routes.filter(r => r.filename == `routes/${ctx.params.slug}.gpx`)[0];
        const geoJson = await strava.routes.getGeoJson(route.filename)

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

            var jsonLayer = L.geoJson(${geoJson}, {
                style: function (feature) {
                    return {color: 'blue'};
                }
            }).addTo(map);
            map.fitBounds(jsonLayer.getBounds());
        `

        return ctx.render({
            routes,
            route,
            mapData,
        });
    },
};

const time = {
    getSeconds: (seconds: number) => seconds % 60,
    getMinutes: (seconds: number) => Math.floor(seconds / 60) % 60,
    getHours: (seconds: number) => Math.floor(Math.floor(seconds / 60) / 60),
}


export const Route = ({ data }: PageProps<Props>) => <>
    <Head>
        <title>{data.route.name}</title>
        <link rel = "stylesheet" href = "http://cdn.leafletjs.com/leaflet-0.7.3/leaflet.css"/>
        <script src = "http://cdn.leafletjs.com/leaflet-0.7.3/leaflet.js"></script>
    </Head>
    <h2>{data.route.name}</h2>

    <section>
        <div id="map" style="width: 100%; height: 24rem; display: inline-block;"></div>
        <script dangerouslySetInnerHTML={{ __html: data.mapData }} defer></script>
    </section>
   
    
</>

export default Route
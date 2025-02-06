import { Head } from "$fresh/runtime.ts";
import { FreshContext, PageProps, Handlers } from "$fresh/src/server/types.ts";
import { StravaDataService } from "../packages/strava.data.service/index.ts";

type Props = {
    mapData: string
}
  
export const handler: Handlers<Props> = {
    async GET(_req: Request, ctx: FreshContext) {
        const folder = (ctx.state?.data as any)?.uid ?? 'export';
        const strava = new StravaDataService(folder)
        const heatmaps = await strava.activities.listHeatmap();

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

            var heatmapLayer = L.layerGroup([
                ${heatmaps?.map(entry => `L.polyline(\r\n
                    [${entry.map((point: number[]) => `[${point[1]}, ${point[0]}]`).join(',\r\n')},],
                    { 'weight': 2, 'color': 'blue' }
                \r\n)`).filter(a => a).join(', ')}
            ])

            map.addLayer(heatmapLayer)
            map.fitBounds(heatmapLayer.getBounds());
        `

        return ctx.render({ mapData });
    },
};

const time = {
    getSeconds: (seconds: number) => seconds % 60,
    getMinutes: (seconds: number) => Math.floor(seconds / 60) % 60,
    getHours: (seconds: number) => Math.floor(Math.floor(seconds / 60) / 60),
}


export const Heatmap = ({ data }: PageProps<Props>) => <>
    <Head>
        <title>Heatmap</title>
        <link rel = "stylesheet" href = "http://cdn.leafletjs.com/leaflet-0.7.3/leaflet.css"/>
        <script src = "http://cdn.leafletjs.com/leaflet-0.7.3/leaflet.js"></script>
    </Head>

    <section class="breakout">
        <div id="map" style="width: 100%; height: calc(100vh - 56px); display: inline-block;"></div>
        <script dangerouslySetInnerHTML={{ __html: data.mapData }} defer></script>
    </section>
</>

export default Heatmap
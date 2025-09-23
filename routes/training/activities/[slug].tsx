import { asset, Head } from "$fresh/runtime.ts";
import { FreshContext, PageProps, Handlers } from "$fresh/src/server/types.ts";
import { StravaDataService } from "../../../packages/strava.data.service/index.ts";
import { GeoJsonManipulator } from "../../../packages/strava.export-data-reader/helpers/geoJsonManipulator.ts";
import { IActivity } from "../../../packages/strava.export-data-reader/interface/activity.ts";
import { IProfile } from "../../../packages/strava.export-data-reader/interface/profile.ts";

type Props = {
    mapData: string
    profile: IProfile
    activity: IActivity
}

export const handler: Handlers<Props> = {
    async GET(_req: Request, ctx: FreshContext) {
        const folder = (ctx.state?.data as any)?.uid ?? 'export';
        const strava = new StravaDataService(folder)

        const { activity, geoJson } = await strava.activities.get(ctx.params.slug);
        const profile = await strava.profile.get();

        let pointMap: [number, number][] = [];

        let pointCount = 0;

        function countPoints(geometry: any): number {
            switch (geometry.type) {
                case "Point":
                return 1;
                case "MultiPoint":
                return geometry.coordinates.length;
                case "LineString":
                return geometry.coordinates.length;
                case "MultiLineString":
                return geometry.coordinates.flat().length;
                case "Polygon":
                return geometry.coordinates.flat().length;
                case "MultiPolygon":
                return geometry.coordinates.flat(2).length;
                case "GeometryCollection":
                return geometry.geometries.reduce((sum: number, g: any) => sum + countPoints(g), 0);
                default:
                return 0;
            }
        }

        for (const feature of JSON.parse(geoJson).features) {
            pointCount += countPoints(feature.geometry);
        }

        console.log(`Total number of coordinate points: ${pointCount}`);
        
        const manipulator = new GeoJsonManipulator()
        let source = JSON.parse(geoJson)
        source = manipulator.simplify(JSON.parse(geoJson), 0.0001);
        //source = smoothGeoJSON(source, 5)
        pointCount = 0;

        for (const feature of source.features) {
            pointCount += countPoints(feature.geometry);
        }

        console.log(`Total number of coordinate points: ${pointCount}`);

        const mapData = `
            const source = ${JSON.stringify(source)}

            // Extract first coordinate from the first feature
            let firstCoord;
            const firstFeature = source.features?.[0];
            if (firstFeature) {
                const geom = firstFeature.geometry;
                if (geom.type === 'Point') {
                    firstCoord = geom.coordinates;
                } else if (geom.type === 'LineString' || geom.type === 'MultiPoint') {
                    firstCoord = geom.coordinates[0];
                } else if (geom.type === 'Polygon' || geom.type === 'MultiLineString') {
                    firstCoord = geom.coordinates[0][0];
                } else if (geom.type === 'MultiPolygon') {
                    firstCoord = geom.coordinates[0][0][0];
                }
            }

            // Initialize the map centered on the first coordinate
            const map = new maplibregl.Map({
                container: 'map',
                style: {
                    version: 8,
                    sources: {
                        osm: {
                            type: 'raster',
                            tiles: [
                                'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
                                'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
                                'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
                            ],
                            tileSize: 256
                        }
                    },
                    layers: [
                        {
                            id: 'osm-layer',
                            type: 'raster',
                            source: 'osm'
                        }
                    ]
                },
                center: firstCoord || [-2.6276908, 53.9690089], // fallback if no coord found
                zoom: 8
            });

            // Add navigation controls
            map.addControl(new maplibregl.NavigationControl());


            // Add GeoJSON layer
            map.on('load', function () {
                map.addSource('my-geojson', {
                    type: 'geojson',
                    data: source // assuming geoJson is a valid JS object
                });

                map.addLayer({
                    id: 'geojson-layer',
                    type: 'line',
                    source: 'my-geojson',
                    paint: {
                        'line-color': 'blue',
                        'line-width': 2
                    }
                });

                // Fit bounds to GeoJSON
                const bounds = new maplibregl.LngLatBounds();
                source.features.forEach(function(feature) {
                    feature.geometry.coordinates.forEach(function(coord) {
                        bounds.extend(coord);
                    });
                });
                map.fitBounds(bounds, { padding: 20 });
            });
        `

        return ctx.render({ profile, activity, mapData });
    },
};

const time = {
    getSeconds: (seconds: number) => seconds % 60,
    getMinutes: (seconds: number) => Math.floor(seconds / 60) % 60,
    getHours: (seconds: number) => Math.floor(Math.floor(seconds / 60) / 60),
}

const UnitDisplay = ({ value, unit, description }: { value: string, unit: string, description: string}) => <div class="unit-display">
    <span class="value">{value}</span>
    <span class="unit">{unit}</span>
    <span class="description">{description}</span>
</div>

export const Activity = ({ data }: PageProps<Props>) => <>
    <Head>
        <title>{data.activity.activity_name}</title>
        <link href="https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.css" rel="stylesheet" />
        <script src="https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.js"></script>
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

    <div class="unit-display">
        <span class="value" />
        <span class="unit" />
        <span class="description" />
    </div>

    <section>
        <div class="unit-row">
            <UnitDisplay unit="km" description="Distance" value={data.activity.distance} />
            <UnitDisplay unit="" description="Moving Time" value={data.activity.moving_time} />
            <UnitDisplay unit="m" description="Elevation" value={data.activity.elevation_gain} />
        </div>
        <br />

        <h3>Speed</h3>
        <p>max: {data.activity.max_speed} kmh</p>
        <p>average: {data.activity.average_speed} kmh</p>
        
        <p>calories: {data.activity.calories}</p>
        <p>elapsed time: {data.activity.elapsed_time}</p>
    </section>
</>

export default Activity
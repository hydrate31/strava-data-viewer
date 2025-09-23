import { asset, Head } from "$fresh/runtime.ts";
import { FreshContext, Handlers, PageProps } from "$fresh/src/server/types.ts";
import { StravaDataService } from "../packages/strava.data.service/index.ts";

type Props = {
  mapData: string;
};

export const handler: Handlers<Props> = {
  async GET(_req: Request, ctx: FreshContext) {
    const folder = (ctx.state?.data as any)?.uid ?? "export";
    const strava = new StravaDataService(folder);
    const source = await strava.activities.fetchHeatmapCache();

    // Extract first coordinate from the first feature
    let firstCoord;
    const firstFeature = source.features?.[0];
    if (firstFeature) {
      const geom = firstFeature.geometry;
      if (geom.type === "Point") {
        firstCoord = geom.coordinates;
      } else if (geom.type === "LineString" || geom.type === "MultiPoint") {
        firstCoord = geom.coordinates[0];
      } else if (geom.type === "Polygon" || geom.type === "MultiLineString") {
        firstCoord = geom.coordinates[0][0];
      } else if (geom.type === "MultiPolygon") {
        firstCoord = geom.coordinates[0][0][0];
      }
    }

    const sourceString = JSON.stringify(source);

    const mapData = `
            const source = ${sourceString};
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
                center: [-2.6276908, 53.9690089], // fallback if no coord found
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
        `;

    return ctx.render({ mapData });
  },
};

const time = {
  getSeconds: (seconds: number) => seconds % 60,
  getMinutes: (seconds: number) => Math.floor(seconds / 60) % 60,
  getHours: (seconds: number) => Math.floor(Math.floor(seconds / 60) / 60),
};

export const Heatmap = ({ data }: PageProps<Props>) => (
  <>
    <Head>
      <title>Heatmap</title>
      <link
        href="https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.css"
        rel="stylesheet"
      />
      <script src="https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.js">
      </script>
    </Head>

    <section class="breakout">
      <div
        id="map"
        style="width: 100%; height: calc(100vh - 56px); display: inline-block;"
      >
      </div>
      <script dangerouslySetInnerHTML={{ __html: data.mapData }} defer></script>
    </section>
  </>
);

export default Heatmap;

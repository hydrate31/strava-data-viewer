import colors from "npm:colors";
import { StravaDataService } from "../../strava.data.service/index.ts";

type Point = [number, number];
type Line = Point[];

const WIDTH = 200;
const HEIGHT = 120;
const PADDING = 8;

const getRouteImageId = (filename: string) => {
    return filename
        .replace("routes/", "")
        .replace(".gpx", "")
        .replaceAll("/", "_")
        .replaceAll("\\", "_")
        .replaceAll("..", "_");
};

const extractLines = (geojson: any): Line[] => {
    const lines: Line[] = [];
    for (const feature of geojson?.features ?? []) {
        const geometry = feature?.geometry;
        if (!geometry?.coordinates) continue;

        switch (geometry.type) {
            case "Point":
                lines.push([geometry.coordinates]);
                break;
            case "MultiPoint":
                for (const point of geometry.coordinates) lines.push([point]);
                break;
            case "LineString":
                lines.push(geometry.coordinates);
                break;
            case "MultiLineString":
                for (const line of geometry.coordinates) lines.push(line);
                break;
            case "Polygon":
                for (const ring of geometry.coordinates) lines.push(ring);
                break;
            case "MultiPolygon":
                for (const polygon of geometry.coordinates) {
                    for (const ring of polygon) lines.push(ring);
                }
                break;
        }
    }

    return lines
        .map((line) => line
            .map((point: any) => [Number(point[0]), Number(point[1])] as Point)
            .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1])))
        .filter((line) => line.length > 0);
};

const buildSvg = (lines: Line[]): string | null => {
    const points = lines.flat();
    if (points.length === 0) return null;

    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => point[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanX = Math.max(maxX - minX, 1e-9);
    const spanY = Math.max(maxY - minY, 1e-9);

    const drawableW = WIDTH - PADDING * 2;
    const drawableH = HEIGHT - PADDING * 2;
    const scale = Math.min(drawableW / spanX, drawableH / spanY);
    const offsetX = (WIDTH - spanX * scale) / 2;
    const offsetY = (HEIGHT - spanY * scale) / 2;

    const pathData = lines.map((line) => {
        const commands = line.map((point, index) => {
            const x = ((point[0] - minX) * scale + offsetX).toFixed(2);
            const y = ((maxY - point[1]) * scale + offsetY).toFixed(2);
            return `${index === 0 ? "M" : "L"}${x} ${y}`;
        });
        return commands.join(" ");
    }).join(" ");

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}"><path d="${pathData}" fill="none" stroke="#3a3a3a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
};

export const routeImages = {
    generate: async (folder: string, strava: StravaDataService) => {
        console.log(colors.blue("::Task::") + "Generating Route Images");
        const outputDir = `./data/${folder}/route-images`;
        try { await Deno.mkdir(outputDir, { recursive: true }); } catch {}

        const routes = await strava.routes.list();
        for (const route of routes) {
            try {
                const geoJsonText = await strava.routes.getGeoJson(route.filename);
                const geojson = JSON.parse(geoJsonText);
                const svg = buildSvg(extractLines(geojson));
                if (!svg) continue;

                const id = getRouteImageId(route.filename);
                await Deno.writeTextFile(`${outputDir}/${id}.svg`, svg);
            } catch (error) {
                console.error(`Failed to generate route image for ${route.filename}`, error);
            }
        }
    }
}

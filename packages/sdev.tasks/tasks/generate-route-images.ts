import colors from "npm:colors";
import { StravaDataService } from "../../strava.data.service/index.ts";
import geoImageGenerator from "../../geo.imagegenerator/index.ts";

const resolveTileServerFromEnv = (): string | undefined => {
    const value = Deno.env.get("GEO_IMAGE_TILING_SERVER")
        ?? Deno.env.get("GEO_IMAGE_TILE_SERVER")
        ?? Deno.env.get("TILING_SERVER")
        ?? Deno.env.get("TILE_SERVER");
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
};

const getRouteImageId = (filename: string) => {
    return filename
        .replace("routes/", "")
        .replace(".gpx", "")
        .replaceAll("/", "_")
        .replaceAll("\\", "_")
        .replaceAll("..", "_");
};

export const routeImages = {
    generate: async (
        folder: string,
        strava: StravaDataService,
        onProgress?: (percentage: number) => Promise<void>,
        throwIfCancelled?: () => Promise<void>,
    ) => {
        console.log(colors.blue("::Task::") + "Generating Route Images");
        const outputDir = `./data/${folder}/route-images`;
        const tilingServer = resolveTileServerFromEnv();
        try { await Deno.mkdir(outputDir, { recursive: true }); } catch {}

        const routes = await strava.routes.list();
        const total = routes.length;
        let processed = 0;
        for (const route of routes) {
            await throwIfCancelled?.();
            try {
                const geoJsonText = await strava.routes.getGeoJson(route.filename);
                const geojson = JSON.parse(geoJsonText);
                const svg = await geoImageGenerator.generateSVG(
                    geojson,
                    {
                        tilingServer,
                        embedTiles: true,
                    },
                );
                if (!svg) continue;

                const id = getRouteImageId(route.filename);
                await Deno.writeTextFile(`${outputDir}/${id}.svg`, svg);
            } catch (error) {
                console.error(`Failed to generate route image for ${route.filename}`, error);
            } finally {
                processed++;
                if (onProgress && total > 0) {
                    await onProgress((processed / total) * 100);
                }
            }
        }
    }
}

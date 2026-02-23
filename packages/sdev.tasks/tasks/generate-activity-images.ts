import colors from "npm:colors";
import { StravaDataService } from "../../strava.data.service/index.ts";
import geoImageGenerator from "../../geo.imagegenerator/index.ts";

export const activityImages = {
    generate: async (
        folder: string,
        strava: StravaDataService,
        onProgress?: (percentage: number) => Promise<void>,
        throwIfCancelled?: () => Promise<void>,
    ) => {
        console.log(colors.blue("::Task::") + "Generating Activity Images");
        const outputDir = `./data/${folder}/activity-images`;
        try { await Deno.mkdir(outputDir, { recursive: true }); } catch {}

        const activities = await strava.activities.list();
        const total = activities.length;
        let processed = 0;
        for (const activity of activities) {
            await throwIfCancelled?.();
            const id = activity.filename
                ?.replace("activities/", "")
                .replace(".fit", "")
                .replace(".gz", "")
                .replace(".gpx", "") || activity.activity_id;

            try {
                const geoJsonText = await strava.activities.getGeoJson(id);
                const geojson = JSON.parse(geoJsonText);
                const svg = geoImageGenerator.generateSVG(geojson);
                if (!svg) continue;

                await Deno.writeTextFile(`${outputDir}/${activity.activity_id}.svg`, svg);
            } catch (error) {
                console.error(`Failed to generate activity image for ${activity.activity_id}`, error);
            } finally {
                processed++;
                if (onProgress && total > 0) {
                    await onProgress((processed / total) * 100);
                }
            }
        }
    }
}

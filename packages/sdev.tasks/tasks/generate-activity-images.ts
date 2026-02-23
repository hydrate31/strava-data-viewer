import colors from "npm:colors";
import { StravaDataService } from "../../strava.data.service/index.ts";
import geoImageGenerator from "../../geo.imagegenerator/index.ts";

export const activityImages = {
    generate: async (folder: string, strava: StravaDataService) => {
        console.log(colors.blue("::Task::") + "Generating Activity Images");
        const outputDir = `./data/${folder}/activity-images`;
        try { await Deno.mkdir(outputDir, { recursive: true }); } catch {}

        const activities = await strava.activities.list();
        for (const activity of activities) {
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
            }
        }
    }
}

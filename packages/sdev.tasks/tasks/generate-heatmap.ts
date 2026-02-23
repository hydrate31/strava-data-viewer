import colors from "npm:colors";

import { StravaDataService } from "../../strava.data.service/index.ts";
import { GeoJsonManipulator } from "../../strava.export-data-reader/helpers/geoJsonManipulator.ts";

export const heatmap = {
    generate: async (folder: string, strava: StravaDataService) => {
        console.log(colors.blue("::Task::") + "Generating Heatmap");

        const activitiesDir = `./data/${folder}/activities`;

        try {
            await Deno.mkdir(`./data/${folder}/heatmap/`);
        } catch {
            console.error("Error:", `Cannot create ./data/${folder}/heatmap/`);
        }

        const manipulator = new GeoJsonManipulator();
        const entries: number[][][] = [];

        const gpxFiles: string[] = [];
        for await (const dirEntry of Deno.readDir(activitiesDir)) {
            if (dirEntry.name.endsWith(".gpx")) {
                gpxFiles.push(dirEntry.name);
            }
        }

        const total = gpxFiles.length;
        let progress = 0;
        let lastLoggedPercentage = 0;

        const batchSize = 2;
        for (let i = 0; i < gpxFiles.length; i += batchSize) {
            const batch = gpxFiles.slice(i, i + batchSize);

            const tasks = batch.map(async (filename) => {
            const id = filename.replace(".gpx", "");
            const gpxPath = `./data/export/activities/${id}.gpx`;

            try {
                const gpxData = await Deno.readTextFile(gpxPath);
                let geoJSON = await strava.activities.getGeoJsonFromGPX(gpxData);
                geoJSON = manipulator.simplify(geoJSON, 0.00019);
                for (let i = 0; i < 32; i++) {
                    geoJSON = manipulator.clean(geoJSON, 1);
                }

                const pointSet = await strava.activities.parseGeoJsonToPoints(geoJSON);
                    pointSet.forEach(points => {
                    entries.push(points.map((point: any) => [point[0], point[1]]));
                });
            } catch (err) {
                console.error(`Error processing ${id}.gpx:`, err);
            } finally {
                const percentage = Math.floor((++progress / total) * 100);
                if (percentage !== lastLoggedPercentage) {
                    lastLoggedPercentage = percentage;
                    Deno.stdout.write(new TextEncoder().encode(
                        `\r${colors.red("::Heatmap::")} ${percentage}%`
                    ));
                }
            }
            });

            await Promise.all(tasks);
        }

        console.log(`\r${colors.red("::Heatmap:: complete")}`);
        console.log(colors.blue("::Task::") + "Writing heatmap.json");
        await strava.activities.cacheHeatmap(entries);
    }
}


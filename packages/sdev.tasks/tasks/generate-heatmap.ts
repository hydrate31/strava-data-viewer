import colors from "npm:colors";

import { StravaDataService } from "../../strava.data.service/index.ts";
import { GeoJsonManipulator } from "../../strava.export-data-reader/helpers/geoJsonManipulator.ts";

export const heatmap = {
    generate: async (
        folder: string,
        strava: StravaDataService,
        onProgress?: (percentage: number) => Promise<void>,
        throwIfCancelled?: () => Promise<void>,
    ) => {
        console.log(colors.blue("::Task::") + "Generating Heatmap");

        const activitiesDir = `./data/${folder}/activities`;

        try {
            await Deno.mkdir(`./data/${folder}/heatmap/`);
        } catch {
            console.error("Error:", `Cannot create ./data/${folder}/heatmap/`);
        }

        const manipulator = new GeoJsonManipulator();
        const entries: number[][][] = [];

        const activityIds = new Set<string>();
        for await (const dirEntry of Deno.readDir(activitiesDir)) {
            if (!dirEntry.isFile) continue;

            if (dirEntry.name.endsWith(".gpx")) {
                activityIds.add(dirEntry.name.replace(".gpx", ""));
            }

            if (dirEntry.name.endsWith(".fit")) {
                activityIds.add(dirEntry.name.replace(".fit", ""));
            }
        }

        const activityList = Array.from(activityIds);
        const total = activityList.length;
        let progress = 0;
        let lastLoggedPercentage = 0;

        if (total === 0) {
            await onProgress?.(100);
            await strava.activities.cacheHeatmap(entries);
            return;
        }

        const batchSize = 2;
        for (let i = 0; i < activityList.length; i += batchSize) {
            await throwIfCancelled?.();
            const batch = activityList.slice(i, i + batchSize);

            const tasks = batch.map(async (id) => {
            try {
                await throwIfCancelled?.();
                const geoJSONText = await strava.activities.getGeoJson(id);
                let geoJSON = JSON.parse(geoJSONText);

                if (!geoJSON?.features?.length) {
                    return;
                }

                geoJSON = manipulator.simplify(geoJSON, 0.00019);
                for (let i = 0; i < 32; i++) {
                    await throwIfCancelled?.();
                    geoJSON = manipulator.clean(geoJSON, 1);
                }

                const pointSet = await strava.activities.parseGeoJsonToPoints(geoJSON);
                    pointSet.forEach(points => {
                    entries.push(points.map((point: any) => [point[0], point[1]]));
                });
            } catch (err) {
                if (err instanceof Error && err.name === "TaskCancelledError") {
                    throw err;
                }
                console.error(`Error processing ${id}:`, err);
            } finally {
                const percentage = Math.floor((++progress / total) * 100);
                if (percentage !== lastLoggedPercentage) {
                    lastLoggedPercentage = percentage;
                    Deno.stdout.write(new TextEncoder().encode(
                        `\r${colors.red("::Heatmap::")} ${percentage}%`
                    ));
                    await onProgress?.(percentage);
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

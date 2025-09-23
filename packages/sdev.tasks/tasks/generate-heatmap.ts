import colors from "npm:colors";

import { StravaDataService } from "../../strava.data.service/index.ts";

export const heatmap = {
    generate: async (folder: string, strava: StravaDataService) => {
        console.log(colors.blue("::Task::") + 'Generating Heatmap');

        const activitiesDir = `./data/${folder}/activities`;

        try { await Deno.mkdir(`./data/${folder}/heatmap/`); } catch {}
        let count = 0;
        for await (const dirEntry of Deno.readDir(activitiesDir)) {
            if (dirEntry.isFile) {
                count++;
            }
        }
        let current = 1;
        let lastloggedPercentage = 0;
        for await (const dirEntry of Deno.readDir(activitiesDir)) {
            if (dirEntry.name.endsWith(".gpx")) {
                const id  = dirEntry.name.replace(".gpx", "");
                const points = await strava.activities.parseGeoJsonToPoints(id);
                const json = {
                    points: points.map(point => [point[0], point[1]])
                }
                try {
                    await Deno.writeTextFile(`./data/${folder}/heatmap/${id}.json`, JSON.stringify(json));
                    const percentage = Math.floor((current / count) * 100)
                    if (percentage !== lastloggedPercentage) {
                        lastloggedPercentage = percentage;
                        console.log(colors.red("::Heatmap::") + ` ${percentage}%\r`);
                    }
                }
                catch {
                    console.log(` Error: ./data/${folder}/heatmap/${id}.json`);
                }
            }
            if (dirEntry.isFile) {
                current++;
            }
        }

        const heatmap = await strava.activities.listHeatmap();
        await strava.activities.cacheHeatmap(heatmap);
    }
}


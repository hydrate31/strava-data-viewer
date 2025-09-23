import colors from "npm:colors";

import { StravaDataService } from "../../strava.data.service/index.ts";
import { GeoJsonManipulator } from "../../strava.export-data-reader/helpers/geoJsonManipulator.ts";

export const heatmap = {
    generate: async (folder: string, strava: StravaDataService) => {
        console.log(colors.blue("::Task::") + 'Generating Heatmap');

        const activitiesDir = `./data/${folder}/activities`;

        try { await Deno.mkdir(`./data/${folder}/heatmap/`); }
                catch {
                    console.error(`Error:`,` Cannot create ./data/${folder}/heatmap/`);
                }
        let count = 0;
        for await (const dirEntry of Deno.readDir(activitiesDir)) {
            if (dirEntry.isFile) {
                count++;
            }
        }
        let current = 1;
        let lastloggedPercentage = 0;
        const manipulator = new GeoJsonManipulator()
        /*for await (const dirEntry of Deno.readDir(activitiesDir)) {
            if (dirEntry.name.endsWith(".fit")) {
                const id  = dirEntry.name.replace(".fit", "");
                manipulator.convertFromFit(dirEntry.name, `${id}.gpx`)
            }
        }*/


        console.log(colors.red("::Heatmap::") + ` Processing ${count} activities...\r`);
        const entries = []
        for await (const dirEntry of Deno.readDir(activitiesDir)) {
            if (dirEntry.name.endsWith(".gpx")) {
                const id  = dirEntry.name.replace(".gpx", "");
                const gpxData = await Deno.readTextFile(`./data/export/activities/${id}.gpx`);
                let geoJSON = await strava.activities.getGeoJsonFromGPX(gpxData);
                geoJSON = manipulator.clean(geoJSON, 20)
                geoJSON = manipulator.simplify(geoJSON, 0.0001)
                const points: any = await strava.activities.parseGeoJsonToPoints(geoJSON);
                const json = {
                    points: points.map((point: any) => [point[0], point[1]])
                }
                try {
                    entries.push(json.points);

                    const percentage = Math.floor((current / count) * 100)
                    if (percentage !== lastloggedPercentage) {
                        lastloggedPercentage = percentage;
                        Deno.stdout.write(new TextEncoder().encode(
                            `\r${ colors.red("::Heatmap::")} ${percentage}%`
                        ));
                    }
                }
                catch {
                    console.error(`Error:`,` ./data/${folder}/heatmap/${id}.json`);
                }
            }
            if (dirEntry.isFile) {
                current++;
            }
        }


        console.log(`\r${colors.red("::Heatmap:: complete")}`);
        console.log(colors.blue("::Task::") + 'Writing heatmap.json');
        await strava.activities.cacheHeatmap(entries);
    }
}

